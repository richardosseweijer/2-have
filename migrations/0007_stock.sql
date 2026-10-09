-- Stock is a balance plus a movement log. Accepting a quote does not write these tables.

create table if not exists stock_balances (
  article_id uuid primary key references articles (id),
  org_id uuid not null references orgs (id),
  on_hand numeric not null default 0,
  foreign key (article_id, org_id) references articles (id, org_id)
);

create table if not exists stock_movements (
  id uuid primary key,
  org_id uuid not null references orgs (id),
  article_id uuid not null,
  qty numeric not null check (qty <> 0),
  kind text not null check (kind in ('receipt', 'issue', 'adjust')),
  project_id uuid,
  note text not null default '',
  created_at timestamptz not null default now(),
  foreign key (article_id, org_id) references articles (id, org_id)
);

create index if not exists stock_movements_article_idx on stock_movements (article_id);

alter table stock_balances enable row level security;
alter table stock_balances force row level security;
drop policy if exists stock_balances_all on stock_balances;
create policy stock_balances_all on stock_balances for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

alter table stock_movements enable row level security;
alter table stock_movements force row level security;
drop policy if exists stock_movements_all on stock_movements;
create policy stock_movements_all on stock_movements for all
  using (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (org_id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_user') then
    grant select, insert, update, delete on stock_balances, stock_movements to app_user;
  end if;
end $$;
