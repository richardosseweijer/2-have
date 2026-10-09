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
drop policy if exists orgs_update on orgs;
create policy orgs_update on orgs for update
  using (id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

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

-- Catalog tables. Applied to existing databases by migrations/0003_articles_catalog.sql.
alter table article_categories enable row level security;
alter table article_categories force row level security;
drop policy if exists article_categories_all on article_categories;
create policy article_categories_all on article_categories for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table article_category_links enable row level security;
alter table article_category_links force row level security;
drop policy if exists article_category_links_all on article_category_links;
create policy article_category_links_all on article_category_links for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

-- Project dates and demand. Applied by migrations/0006_projects.sql.
alter table project_days enable row level security;
alter table project_days force row level security;
drop policy if exists project_days_all on project_days;
create policy project_days_all on project_days for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table project_demands enable row level security;
alter table project_demands force row level security;
drop policy if exists project_demands_all on project_demands;
create policy project_demands_all on project_demands for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

-- Shelf and movements. Applied by migrations/0007_stock.sql.
alter table stock_balances enable row level security;
alter table stock_balances force row level security;
drop policy if exists stock_balances_all on stock_balances;
create policy stock_balances_all on stock_balances for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table stock_movements enable row level security;
alter table stock_movements force row level security;
drop policy if exists stock_movements_all on stock_movements;
create policy stock_movements_all on stock_movements for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

-- Inkoop. Applied by migrations/0008_purchases.sql.
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


