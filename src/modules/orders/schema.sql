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
