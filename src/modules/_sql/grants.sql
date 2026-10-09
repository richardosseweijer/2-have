-- Non-superuser role so FORCE ROW LEVEL SECURITY applies in the preview,
-- where the connection is a superuser (superusers ignore FORCE). On a hosted
-- database that cannot create roles, the table owner is already subject to
-- FORCE ROW LEVEL SECURITY and these grants are skipped.
-- This file is the full list. migrations/0002_business.sql baked an earlier copy.
-- migrations/0003_articles_catalog.sql grants the catalog tables on databases
-- that already ran 0002.
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
      article_categories, article_category_links,
      quotes, quote_lines, quote_counters,
      deals, orders, order_lines, order_counters,
      projects, project_days, project_demands, crew_members, assignments,
      stock_balances, stock_movements,
      suppliers, purchase_counters, purchase_orders, purchase_lines
    to app_user;
    grant execute on function accept_quote(uuid) to app_user;
  end if;
end $$;
