-- Readable shape of the articles module.
-- A database that already ran migrations/0002_business.sql does not re-read this file.
-- The delta is migrations/0003_articles_catalog.sql.
--
-- Sell price and cost live on the article. Quote and order lines keep their own
-- sell price. min_qty is stored here; stock movements are a later step.
-- unique (id, org_id) exists so a category link cannot point across organisations.

create table if not exists articles (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  unit text not null,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  min_qty numeric not null default 0 check (min_qty >= 0),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create index if not exists articles_org_idx on articles (org_id);

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

-- Balance is the shelf. Movements are the reason it changed.
-- Applied by migrations/0007_stock.sql.
create table if not exists stock_balances (
  article_id uuid primary key references articles (id),
  org_id uuid not null references orgs (id),
  on_hand numeric not null default 0,
  foreign key (article_id, org_id) references articles (id, org_id)
);

create table if not exists stock_movements (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  article_id uuid not null,
  qty numeric not null check (qty <> 0),
  kind text not null check (kind in ('receipt', 'issue', 'adjust')),
  project_id uuid,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (article_id, org_id) references articles (id, org_id)
);

create index if not exists stock_movements_article_idx on stock_movements (article_id);

