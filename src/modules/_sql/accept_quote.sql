-- Database contract for accepting a quote in one transaction.
-- The application entry point is quotes.acceptQuote, which calls deals and
-- orders on the same transaction handle. This function encodes the same rules
-- for a direct SQL caller: org check, draft or sent only, snapshot copy.
create or replace function accept_quote(quote_id uuid)
returns uuid
language plpgsql
as $$
declare
  v_user text := current_setting('app.user_id', true);
  v_org uuid;
  v_customer uuid;
  v_status text;
  v_quote_number text;
  v_order_number text;
  v_deal uuid;
  v_order uuid;
  v_n integer;
  line record;
begin
  if v_user is null or v_user = '' then
    raise exception 'not authenticated';
  end if;

  select q.org_id, q.customer_id, q.status, q.number
    into v_org, v_customer, v_status, v_quote_number
  from quotes q
  where q.id = accept_quote.quote_id
  for update;

  if v_org is null then
    raise exception 'quote not found';
  end if;

  if not exists (
    select 1 from org_members m
    where m.org_id = v_org and m.user_id = v_user
  ) then
    raise exception 'wrong org';
  end if;

  if v_status not in ('draft', 'sent') then
    raise exception 'quote cannot be accepted';
  end if;

  if v_quote_number is null then
    insert into quote_counters (org_id, last_value)
    values (v_org, 1)
    on conflict (org_id) do update
      set last_value = quote_counters.last_value + 1
    returning last_value into v_n;
    v_quote_number := 'OFF-' || lpad(v_n::text, 4, '0');
  end if;

  select d.id into v_deal
  from deals d
  where d.quote_id = accept_quote.quote_id and d.org_id = v_org
  for update;

  if v_deal is null then
    v_deal := gen_random_uuid();
    insert into deals (id, org_id, quote_id, customer_id, status)
    values (v_deal, v_org, accept_quote.quote_id, v_customer, 'won');
  else
    update deals set status = 'won' where id = v_deal and org_id = v_org;
  end if;

  insert into order_counters (org_id, last_value)
  values (v_org, 1)
  on conflict (org_id) do update
    set last_value = order_counters.last_value + 1
  returning last_value into v_n;
  v_order_number := 'ORD-' || lpad(v_n::text, 4, '0');

  v_order := gen_random_uuid();
  insert into orders (id, org_id, quote_id, deal_id, customer_id, number, status)
  values (v_order, v_org, accept_quote.quote_id, v_deal, v_customer, v_order_number, 'confirmed');

  for line in
    select description, qty, unit, unit_price_cents, position
    from quote_lines
    where quote_lines.quote_id = accept_quote.quote_id
      and quote_lines.org_id = v_org
    order by position
  loop
    insert into order_lines (id, org_id, order_id, description, qty, unit, unit_price_cents, position)
    values (
      gen_random_uuid(),
      v_org,
      v_order,
      line.description,
      line.qty,
      line.unit,
      line.unit_price_cents,
      line.position
    );
  end loop;

  update quotes
    set status = 'accepted', number = v_quote_number
    where id = accept_quote.quote_id and org_id = v_org;

  return v_order;
end;
$$;
