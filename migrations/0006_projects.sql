-- Projects become the hub: customer, optional quote and order, dates, material demand.
-- Accepting a quote does not create a project yet. That is the next step.

alter table projects add column if not exists customer_id uuid references customers (id);
alter table projects add column if not exists quote_id uuid;
alter table projects add column if not exists order_id uuid;
alter table projects add column if not exists status text not null default 'planned';
alter table projects add column if not exists required_crew integer not null default 0;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'projects_id_org_key') then
    alter table projects add constraint projects_id_org_key unique (id, org_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_quote_id_key') then
    alter table projects add constraint projects_quote_id_key unique (quote_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_order_id_key') then
    alter table projects add constraint projects_order_id_key unique (order_id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_quote_id_fkey') then
    alter table projects add constraint projects_quote_id_fkey foreign key (quote_id) references quotes (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_order_id_fkey') then
    alter table projects add constraint projects_order_id_fkey foreign key (order_id) references orders (id);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_status_check') then
    alter table projects add constraint projects_status_check
      check (status in ('planned', 'in_progress', 'done', 'cancelled'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'projects_required_crew_check') then
    alter table projects add constraint projects_required_crew_check check (required_crew >= 0);
  end if;
end $$;

create table if not exists project_days (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  project_id uuid not null references projects (id) on delete cascade,
  work_date date not null,
  required_crew integer not null check (required_crew >= 0),
  unique (project_id, work_date)
);

create index if not exists project_days_org_idx on project_days (org_id);

create table if not exists project_demands (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  project_id uuid not null references projects (id) on delete cascade,
  article_id uuid not null references articles (id),
  description text not null,
  unit text not null,
  qty_needed numeric not null check (qty_needed > 0),
  qty_issued numeric not null default 0 check (qty_issued >= 0),
  source text not null check (source in ('quote_line', 'manual')),
  quote_line_id uuid
);

create index if not exists project_demands_project_idx on project_demands (project_id);

alter table project_days enable row level security;
alter table project_days force row level security;
drop policy if exists project_days_all on project_days;
create policy project_days_all on project_days for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table project_demands enable row level security;
alter table project_demands force row level security;
drop policy if exists project_demands_all on project_demands;
create policy project_demands_all on project_demands for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant select, insert, update, delete on project_days, project_demands to app_user;
  end if;
end $$;
