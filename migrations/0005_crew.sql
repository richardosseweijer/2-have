-- Crew contact data on the existing people table. No assignments yet.

alter table crew_members add column if not exists phone text not null default '';
alter table crew_members add column if not exists email text not null default '';
alter table crew_members add column if not exists kind text not null default 'employee';
alter table crew_members add column if not exists company text not null default '';
alter table crew_members add column if not exists notes text not null default '';
alter table crew_members add column if not exists active boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'crew_members_kind_check') then
    alter table crew_members
      add constraint crew_members_kind_check
      check (kind in ('employee', 'freelancer'));
  end if;
end $$;
