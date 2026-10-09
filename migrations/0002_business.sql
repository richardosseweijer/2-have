-- Concatenation of module schema files, then RLS, then accept_quote. Edit the sources under src/modules, not this file.

-- identity: organisations and membership. The shell owns no business tables.
create table if not exists orgs (
  id uuid primary key,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id uuid not null references orgs (id),
  user_id text not null,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create unique index if not exists org_members_one_org_per_user on org_members (user_id);


-- customers
create table if not exists customers (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  email text,
  phone text,
  city text,
  created_at timestamptz not null default now()
);

create index if not exists customers_org_idx on customers (org_id);


-- articles. Current price lives here. Quote and order lines keep their own copy.
create table if not exists articles (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  unit text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  created_at timestamptz not null default now()
);

create index if not exists articles_org_idx on articles (org_id);


-- quotes. number (OFF-0001) is allocated in the accept transaction.
create table if not exists quotes (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  customer_id uuid not null references customers (id),
  number text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  unique (org_id, number)
);

create table if not exists quote_lines (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  quote_id uuid not null references quotes (id) on delete cascade,
  article_id uuid references articles (id),
  description text not null,
  qty numeric not null check (qty > 0),
  unit text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  position integer not null,
  unique (quote_id, position)
);

create index if not exists quote_lines_quote_idx on quote_lines (quote_id);

create table if not exists quote_counters (
  org_id uuid primary key references orgs (id),
  last_value integer not null
);


-- deals. Written only by the deals module, called only from quotes.
create table if not exists deals (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  quote_id uuid not null unique references quotes (id),
  customer_id uuid not null references customers (id),
  status text not null default 'open' check (status in ('open', 'won', 'lost')),
  created_at timestamptz not null default now()
);

create index if not exists deals_org_idx on deals (org_id);


-- orders. number (ORD-0001) is allocated when a quote is accepted.
create table if not exists orders (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  quote_id uuid not null unique references quotes (id),
  deal_id uuid not null references deals (id),
  customer_id uuid not null references customers (id),
  number text not null,
  status text not null default 'confirmed' check (status in ('confirmed', 'in_progress', 'done', 'cancelled')),
  created_at timestamptz not null default now(),
  unique (org_id, number)
);

create table if not exists order_lines (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  order_id uuid not null references orders (id) on delete cascade,
  description text not null,
  qty numeric not null check (qty > 0),
  unit text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  position integer not null
);

create index if not exists order_lines_order_idx on order_lines (order_id);

create table if not exists order_counters (
  org_id uuid primary key references orgs (id),
  last_value integer not null
);


-- projects. Schema only for now; the page is a stub.
create table if not exists projects (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists projects_org_idx on projects (org_id);


-- planning. Crew and assignments exist; the page is a stub.
create table if not exists crew_members (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists crew_members_org_idx on crew_members (org_id);

create table if not exists assignments (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  crew_member_id uuid not null references crew_members (id),
  project_id uuid references projects (id),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists assignments_org_idx on assignments (org_id);


-- RLS. Every business table is scoped to the caller's organisation.
-- app.user_id is set for the transaction before any read or write.
-- Table owners bypass RLS unless it is forced. Preview connects as a superuser,
-- which still bypasses FORCE, so the app sets role app_user inside the transaction.

alter table orgs enable row level security;
alter table orgs force row level security;
drop policy if exists orgs_select on orgs;
create policy orgs_select on orgs for select
  using (
    id in (
      select org_id from org_members
      where user_id = current_setting('app.user_id', true)
    )
  );
drop policy if exists orgs_insert on orgs;
create policy orgs_insert on orgs for insert
  with check (current_setting('app.user_id', true) <> '');

alter table org_members enable row level security;
alter table org_members force row level security;
drop policy if exists org_members_select on org_members;
create policy org_members_select on org_members for select
  using (user_id = current_setting('app.user_id', true));
drop policy if exists org_members_insert on org_members;
create policy org_members_insert on org_members for insert
  with check (
    user_id = current_setting('app.user_id', true)
    and role = 'owner'
  );

-- Shared predicate: the row's org is one the current user belongs to.
-- Inlined per table because policies cannot share a view under RLS cleanly.

alter table customers enable row level security;
alter table customers force row level security;
drop policy if exists customers_all on customers;
create policy customers_all on customers for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table articles enable row level security;
alter table articles force row level security;
drop policy if exists articles_all on articles;
create policy articles_all on articles for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table quotes enable row level security;
alter table quotes force row level security;
drop policy if exists quotes_all on quotes;
create policy quotes_all on quotes for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table quote_lines enable row level security;
alter table quote_lines force row level security;
drop policy if exists quote_lines_all on quote_lines;
create policy quote_lines_all on quote_lines for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table quote_counters enable row level security;
alter table quote_counters force row level security;
drop policy if exists quote_counters_all on quote_counters;
create policy quote_counters_all on quote_counters for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table deals enable row level security;
alter table deals force row level security;
drop policy if exists deals_all on deals;
create policy deals_all on deals for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table orders enable row level security;
alter table orders force row level security;
drop policy if exists orders_all on orders;
create policy orders_all on orders for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table order_lines enable row level security;
alter table order_lines force row level security;
drop policy if exists order_lines_all on order_lines;
create policy order_lines_all on order_lines for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table order_counters enable row level security;
alter table order_counters force row level security;
drop policy if exists order_counters_all on order_counters;
create policy order_counters_all on order_counters for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table projects enable row level security;
alter table projects force row level security;
drop policy if exists projects_all on projects;
create policy projects_all on projects for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table crew_members enable row level security;
alter table crew_members force row level security;
drop policy if exists crew_members_all on crew_members;
create policy crew_members_all on crew_members for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table assignments enable row level security;
alter table assignments force row level security;
drop policy if exists assignments_all on assignments;
create policy assignments_all on assignments for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));


-- Database contract for accepting a quote in one transaction.
-- The application entry point is quotes.acceptQuote, which calls deals and
-- orders on the same transaction handle. This function encodes the same rules
-- for a direct SQL caller: org check, draft or sent only, snapshot copy.
create or replace function accept_quote(quote_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_user text := current_setting('app.user_id', true);
  v_org uuid;
  v_customer uuid;
  v_status text;
  v_quote_number text;
  v_order_number text;
  v_deal uuid;
  v_order uuid;
  v_n integer;
  line record;
begin
  if v_user is null or v_user = '' then
    raise exception 'not authenticated';
  end if;

  select q.org_id, q.customer_id, q.status, q.number
    into v_org, v_customer, v_status, v_quote_number
  from quotes q
  where q.id = accept_quote.quote_id
  for update;

  if v_org is null then
    raise exception 'quote not found';
  end if;

  if not exists (
    select 1 from org_members m
    where m.org_id = v_org and m.user_id = v_user
  ) then
    raise exception 'wrong org';
  end if;

  if v_status not in ('draft', 'sent') then
    raise exception 'quote cannot be accepted';
  end if;

  if v_quote_number is null then
    insert into quote_counters (org_id, last_value)
    values (v_org, 1)
    on conflict (org_id) do update
      set last_value = quote_counters.last_value + 1
    returning last_value into v_n;
    v_quote_number := 'OFF-' || lpad(v_n::text, 4, '0');
  end if;

  select d.id into v_deal
  from deals d
  where d.quote_id = accept_quote.quote_id and d.org_id = v_org
  for update;

  if v_deal is null then
    v_deal := gen_random_uuid();
    insert into deals (id, org_id, quote_id, customer_id, status)
    values (v_deal, v_org, accept_quote.quote_id, v_customer, 'won');
  else
    update deals set status = 'won' where id = v_deal and org_id = v_org;
  end if;

  insert into order_counters (org_id, last_value)
  values (v_org, 1)
  on conflict (org_id) do update
    set last_value = order_counters.last_value + 1
  returning last_value into v_n;
  v_order_number := 'ORD-' || lpad(v_n::text, 4, '0');

  v_order := gen_random_uuid();
  insert into orders (id, org_id, quote_id, deal_id, customer_id, number, status)
  values (v_order, v_org, accept_quote.quote_id, v_deal, v_customer, v_order_number, 'confirmed');

  for line in
    select description, qty, unit, unit_price_cents, position
    from quote_lines
    where quote_lines.quote_id = accept_quote.quote_id
      and quote_lines.org_id = v_org
    order by position
  loop
    insert into order_lines (id, org_id, order_id, description, qty, unit, unit_price_cents, position)
    values (
      gen_random_uuid(),
      v_org,
      v_order,
      line.description,
      line.qty,
      line.unit,
      line.unit_price_cents,
      line.position
    );
  end loop;

  update quotes
    set status = 'accepted', number = v_quote_number
    where id = accept_quote.quote_id and org_id = v_org;

  return v_order;
end;
$$;


-- Non-superuser role so FORCE ROW LEVEL SECURITY applies in the preview,
-- where the connection is a superuser (superusers ignore FORCE). On a hosted
-- database that cannot create roles, the table owner is already subject to
-- FORCE ROW LEVEL SECURITY and these grants are skipped.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    begin
      create role app_user nosuperuser nologin;
    exception
      when insufficient_privilege then
        null;
    end;
  end if;

  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant usage on schema public to app_user;
    grant select, insert, update, delete on
      orgs, org_members, customers, articles,
      quotes, quote_lines, quote_counters,
      deals, orders, order_lines, order_counters,
      projects, crew_members, assignments
    to app_user;
    grant execute on function accept_quote(uuid) to app_user;
  end if;
end $$;

