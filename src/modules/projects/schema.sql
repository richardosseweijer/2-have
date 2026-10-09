-- projects. Schema only for now; the page is a stub.
create table if not exists projects (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  created_at timestamptz not null default now()
);

create index if not exists projects_org_idx on projects (org_id);
