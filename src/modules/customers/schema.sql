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
