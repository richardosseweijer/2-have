-- Default markup on the organisation, copied onto a quote, overridable per line.
-- Does not reprice existing lines from the article. Old lines get cost 0.

alter table orgs
  add column if not exists default_markup_bps integer not null default 0;

alter table quotes
  add column if not exists markup_bps integer not null default 0;

alter table quote_lines
  add column if not exists cost_cents integer not null default 0;

alter table quote_lines
  add column if not exists markup_bps integer;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'orgs_default_markup_bps_check') then
    alter table orgs
      add constraint orgs_default_markup_bps_check
      check (default_markup_bps between 0 and 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quotes_markup_bps_check') then
    alter table quotes
      add constraint quotes_markup_bps_check
      check (markup_bps between 0 and 100000);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_lines_cost_cents_check') then
    alter table quote_lines
      add constraint quote_lines_cost_cents_check
      check (cost_cents >= 0);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'quote_lines_markup_bps_check') then
    alter table quote_lines
      add constraint quote_lines_markup_bps_check
      check (markup_bps is null or markup_bps between -10000 and 100000);
  end if;
end $$;

-- Creating an organisation was allowed. Changing one was not, so a markup save
-- updated zero rows and looked successful. Members of the org may update it.
drop policy if exists orgs_update on orgs;
create policy orgs_update on orgs for update
  using (id in (select org_id from org_members where user_id = current_setting('app.user_id', true)))
  with check (id in (select org_id from org_members where user_id = current_setting('app.user_id', true)));

