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
