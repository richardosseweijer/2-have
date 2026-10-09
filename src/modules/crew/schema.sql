-- crew owns the people. The table was created in migrations/0002_business.sql.
-- Contact fields and active are applied by migrations/0005_crew.sql.
-- People are deactivated, not deleted, so later planning can keep the name.
create table if not exists crew_members (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  phone text not null default '',
  email text not null default '',
  kind text not null default 'employee' check (kind in ('employee', 'freelancer')),
  company text not null default '',
  notes text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create index if not exists crew_members_org_idx on crew_members (org_id);
