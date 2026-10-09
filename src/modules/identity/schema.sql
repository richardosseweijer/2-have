-- identity: organisations and membership. The shell owns no business tables.
-- default_markup_bps is basis points (3500 = 35%). Applied by migrations/0004_quote_markup.sql.
create table if not exists orgs (
  id uuid primary key,
  name text not null,
  default_markup_bps integer not null default 0 check (default_markup_bps between 0 and 100000),
  created_at timestamptz not null default now()
);

create table if not exists org_members (
  org_id uuid not null references orgs (id),
  user_id text not null,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (org_id, user_id)
);

create unique index if not exists org_members_one_org_per_user on org_members (user_id);
