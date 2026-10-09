-- projects. Empty projects are created by hand. Accepting a quote will also create one.
-- Execution dates and material demand live here. Stock is not moved from this module's tables.
-- Existing databases get the extra columns from migrations/0006_projects.sql.
create table if not exists projects (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  name text not null,
  customer_id uuid references customers (id),
  quote_id uuid unique references quotes (id),
  order_id uuid unique references orders (id),
  status text not null default 'planned' check (status in ('planned', 'in_progress', 'done', 'cancelled')),
  required_crew integer not null default 0 check (required_crew >= 0),
  created_at timestamptz not null default now(),
  unique (id, org_id)
);

create index if not exists projects_org_idx on projects (org_id);

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
