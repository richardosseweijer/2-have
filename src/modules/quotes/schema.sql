-- quotes. number (OFF-0001) is allocated in the accept transaction.
-- markup_bps is the quote-wide percentage on top of cost (basis points).
-- A line markup_bps null means "use the quote". Cost and sell price are snapshotted.
-- Applied for existing databases by migrations/0004_quote_markup.sql.
create table if not exists quotes (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  customer_id uuid not null references customers (id),
  number text,
  status text not null default 'draft' check (status in ('draft', 'sent', 'accepted', 'rejected')),
  markup_bps integer not null default 0 check (markup_bps between 0 and 100000),
  created_at timestamptz not null default now(),
  unique (org_id, number)
);

create table if not exists quote_lines (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  quote_id uuid not null references quotes (id) on delete cascade,
  article_id uuid references articles (id),
  description text not null,
  qty numeric not null check (qty > 0),
  unit text not null,
  cost_cents integer not null default 0 check (cost_cents >= 0),
  markup_bps integer check (markup_bps is null or markup_bps between -10000 and 100000),
  unit_price_cents integer not null check (unit_price_cents >= 0),
  position integer not null,
  unique (quote_id, position)
);

create index if not exists quote_lines_quote_idx on quote_lines (quote_id);

create table if not exists quote_counters (
  org_id uuid primary key references orgs (id),
  last_value integer not null
);
