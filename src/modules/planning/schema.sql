-- planning owns assignments. People live in the crew module.
-- One person, one project, one day. The date must be a project day.
-- migrations/0009_planning.sql replaces the unused starts_on/ends_on table.
create table if not exists assignments (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  crew_member_id uuid not null,
  project_id uuid not null,
  work_date date not null,
  status text not null check (status in ('asked', 'confirmed', 'declined')),
  created_at timestamptz not null default now(),
  unique (crew_member_id, project_id, work_date),
  foreign key (crew_member_id, org_id) references crew_members (id, org_id),
  foreign key (project_id, org_id) references projects (id, org_id),
  foreign key (project_id, work_date) references project_days (project_id, work_date) on delete cascade
);

create index if not exists assignments_org_day_idx on assignments (org_id, work_date);
