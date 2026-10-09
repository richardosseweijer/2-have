import type { Tx } from "@/lib/db";
import { asNumber } from "@/lib/money";
import { createFromQuoteInput, type OrderDetail, type OrderLine, type OrderSummary } from "./boundary";

async function allocateOrderNumber(tx: Tx, orgId: string): Promise<string> {
  const rows = await tx.query<{ last_value: unknown }>(
    `insert into order_counters (org_id, last_value)
     values ($1, 1)
     on conflict (org_id) do update
       set last_value = order_counters.last_value + 1
     returning last_value`,
    [orgId],
  );
  return `ORD-${String(asNumber(rows[0]?.last_value)).padStart(4, "0")}`;
}

function mapLine(row: {
  id: string;
  description: string;
  qty: unknown;
  unit: string;
  unit_price_cents: unknown;
  position: unknown;
  line_total_cents: unknown;
}): OrderLine {
  return {
    id: row.id,
    description: row.description,
    qty: String(row.qty),
    unit: row.unit,
    unitPriceCents: asNumber(row.unit_price_cents),
    position: asNumber(row.position),
    lineTotalCents: asNumber(row.line_total_cents),
  };
}

/**
 * Copies a quote's snapshotted lines onto a new confirmed order.
 * Does not read articles and does not write quote tables.
 */
export async function createFromQuote(
  tx: Tx,
  input: {
    orgId: string;
    quoteId: string;
    dealId: string;
    customerId: string;
    lines: Array<{
      description: string;
      qty: string;
      unit: string;
      unitPriceCents: number;
      position: number;
    }>;
  },
): Promise<{ id: string; number: string }> {
  const data = createFromQuoteInput.parse(input);
  const number = await allocateOrderNumber(tx, data.orgId);
  const id = crypto.randomUUID();
  await tx.query(
    `insert into orders (id, org_id, quote_id, deal_id, customer_id, number, status)
     values ($1, $2, $3, $4, $5, $6, 'confirmed')`,
    [id, data.orgId, data.quoteId, data.dealId, data.customerId, number],
  );
  for (const line of data.lines) {
    await tx.query(
      `insert into order_lines
         (id, org_id, order_id, description, qty, unit, unit_price_cents, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        crypto.randomUUID(),
        data.orgId,
        id,
        line.description,
        line.qty,
        line.unit,
        line.unitPriceCents,
        line.position,
      ],
    );
  }
  return { id, number };
}

export async function listOrders(tx: Tx, orgId: string): Promise<OrderSummary[]> {
  const rows = await tx.query<{
    id: string;
    number: string;
    status: OrderSummary["status"];
    customer_name: string;
    quote_number: string | null;
    total_cents: unknown;
    created_on: string;
  }>(
    `select o.id,
            o.number,
            o.status,
            c.name as customer_name,
            q.number as quote_number,
            coalesce((
              select round(sum(l.qty * l.unit_price_cents))::int
                from order_lines l
               where l.order_id = o.id
            ), 0) as total_cents,
            to_char(o.created_at at time zone 'Europe/Amsterdam', 'DD-MM-YYYY') as created_on
       from orders o
       join customers c on c.id = o.customer_id and c.org_id = o.org_id
       join quotes q on q.id = o.quote_id and q.org_id = o.org_id
      where o.org_id = $1
      order by o.created_at desc`,
    [orgId],
  );
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    customerName: row.customer_name,
    quoteNumber: row.quote_number,
    totalCents: asNumber(row.total_cents),
    createdOn: row.created_on,
  }));
}

export async function getOrder(
  tx: Tx,
  orgId: string,
  orderId: string,
): Promise<OrderDetail | null> {
  const rows = await tx.query<{
    id: string;
    number: string;
    status: OrderSummary["status"];
    customer_name: string;
    quote_id: string;
    quote_number: string | null;
    created_on: string;
  }>(
    `select o.id,
            o.number,
            o.status,
            c.name as customer_name,
            o.quote_id,
            q.number as quote_number,
            to_char(o.created_at at time zone 'Europe/Amsterdam', 'DD-MM-YYYY') as created_on
       from orders o
       join customers c on c.id = o.customer_id and c.org_id = o.org_id
       join quotes q on q.id = o.quote_id and q.org_id = o.org_id
      where o.org_id = $1 and o.id = $2`,
    [orgId, orderId],
  );
  const order = rows[0];
  if (!order) return null;
  const lines = await tx.query<{
    id: string;
    description: string;
    qty: unknown;
    unit: string;
    unit_price_cents: unknown;
    position: unknown;
    line_total_cents: unknown;
  }>(
    `select id, description, qty::text as qty, unit, unit_price_cents, position,
            round(qty * unit_price_cents)::int as line_total_cents
       from order_lines
      where order_id = $1 and org_id = $2
      order by position asc`,
    [orderId, orgId],
  );
  const mapped = lines.map(mapLine);
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    customerName: order.customer_name,
    quoteId: order.quote_id,
    quoteNumber: order.quote_number,
    createdOn: order.created_on,
    totalCents: mapped.reduce((sum, line) => sum + line.lineTotalCents, 0),
    lines: mapped,
  };
}
