-- planning. Crew and assignments exist; the page is a stub.
create table if not exists crew_members (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists crew_members_org_idx on crew_members (org_id);

create table if not exists assignments (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  crew_member_id uuid not null references crew_members (id),
  project_id uuid references projects (id),
  starts_on date not null,
  ends_on date not null,
  created_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

create index if not exists assignments_org_idx on assignments (org_id);
