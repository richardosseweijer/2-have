-- Inkoop. Draft orders are not underway. Line cost does not rewrite the article.

create table if not exists suppliers (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  phone text not null default '',
  email text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create unique index if not exists suppliers_name_idx
  on suppliers (org_id, lower(btrim(name)));

create table if not exists purchase_counters (
  org_id uuid primary key references orgs (id),
  last_value integer not null
);

create table if not exists purchase_orders (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  supplier_id uuid not null,
  number text,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partial', 'received', 'cancelled')),
  expected_on date,
  created_at timestamptz not null default now(),
  unique (id, org_id),
  unique (org_id, number),
  foreign key (supplier_id, org_id) references suppliers (id, org_id),
  check (status not in ('ordered', 'partial', 'received') or expected_on is not null),
  check (status in ('draft', 'cancelled') or number is not null)
);

create index if not exists purchase_orders_org_idx on purchase_orders (org_id, expected_on);

create table if not exists purchase_lines (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  purchase_order_id uuid not null,
  article_id uuid not null,
  description text not null,
  unit text not null,
  qty_ordered numeric not null check (qty_ordered > 0),
  qty_received numeric not null default 0 check (qty_received >= 0 and qty_received <= qty_ordered),
  unit_cost_cents integer not null check (unit_cost_cents >= 0),
  created_at timestamptz not null default now(),
  foreign key (purchase_order_id, org_id) references purchase_orders (id, org_id) on delete cascade,
  foreign key (article_id, org_id) references articles (id, org_id)
);

create index if not exists purchase_lines_article_idx on purchase_lines (article_id);
create index if not exists purchase_lines_order_idx on purchase_lines (purchase_order_id);

alter table suppliers enable row level security;
alter table suppliers force row level security;
drop policy if exists suppliers_all on suppliers;
create policy suppliers_all on suppliers for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table purchase_counters enable row level security;
alter table purchase_counters force row level security;
drop policy if exists purchase_counters_all on purchase_counters;
create policy purchase_counters_all on purchase_counters for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table purchase_orders enable row level security;
alter table purchase_orders force row level security;
drop policy if exists purchase_orders_all on purchase_orders;
create policy purchase_orders_all on purchase_orders for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table purchase_lines enable row level security;
alter table purchase_lines force row level security;
drop policy if exists purchase_lines_all on purchase_lines;
create policy purchase_lines_all on purchase_lines for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant select, insert, update, delete on suppliers, purchase_counters, purchase_orders, purchase_lines to app_user;
  end if;
end $$;
