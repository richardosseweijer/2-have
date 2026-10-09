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
