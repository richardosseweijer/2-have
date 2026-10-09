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
