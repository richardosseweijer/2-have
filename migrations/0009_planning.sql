-- One row per person per project per day. The old date-range table was unused.
-- Only a confirmed row counts toward the day's required crew. Conflicts are allowed.

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crew_members_id_org') then
    alter table crew_members add constraint crew_members_id_org unique (id, org_id);
  end if;
end $$;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'assignments' and column_name = 'starts_on'
  ) then
    drop table assignments;
  end if;
end $$;

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

alter table assignments enable row level security;
alter table assignments force row level security;
drop policy if exists assignments_all on assignments;
create policy assignments_all on assignments for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant select, insert, update, delete on assignments to app_user;
  end if;
end $$;
