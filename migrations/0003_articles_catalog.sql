-- Articles: cost, minimum quantity, and many categories per article.
-- Does not touch quotes or orders. Sell price on a line stays where it was copied.

alter table articles
  add column if not exists cost_cents integer not null default 0 check (cost_cents >= 0);

alter table articles
  add column if not exists min_qty numeric not null default 0 check (min_qty >= 0);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'articles_id_org_key') then
    alter table articles add constraint articles_id_org_key unique (id, org_id);
  end if;
end $$;

create table if not exists article_categories (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create unique index if not exists article_categories_org_name_idx
  on article_categories (org_id, lower(btrim(name)));

create index if not exists article_categories_org_idx on article_categories (org_id);

create table if not exists article_category_links (
  article_id uuid not null,
  category_id uuid not null,
  org_id uuid not null references orgs (id),
  primary key (article_id, category_id),
  foreign key (article_id, org_id) references articles (id, org_id) on delete cascade,
  foreign key (category_id, org_id) references article_categories (id, org_id) on delete cascade
);

create index if not exists article_category_links_category_idx
  on article_category_links (category_id);

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

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant select, insert, update, delete on article_categories, article_category_links to app_user;
  end if;
end $$;
