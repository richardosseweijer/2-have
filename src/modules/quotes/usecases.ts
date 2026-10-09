import { loseDeal, openDeal, winDeal } from "../deals";
import { createFromQuote } from "../orders";
import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { asNumber } from "@/lib/money";
import {
  createQuoteInput,
  type QuoteDetail,
  type QuoteLine,
  type QuoteSummary,
} from "./boundary";

async function allocateQuoteNumber(tx: Tx, orgId: string): Promise<string> {
  const rows = await tx.query<{ last_value: unknown }>(
    `insert into quote_counters (org_id, last_value)
     values ($1, 1)
     on conflict (org_id) do update
       set last_value = quote_counters.last_value + 1
     returning last_value`,
    [orgId],
  );
  return `OFF-${String(asNumber(rows[0]?.last_value)).padStart(4, "0")}`;
}

function mapLine(row: {
  id: string;
  article_id: string | null;
  description: string;
  qty: unknown;
  unit: string;
  unit_price_cents: unknown;
  position: unknown;
  line_total_cents: unknown;
}): QuoteLine {
  return {
    id: row.id,
    articleId: row.article_id,
    description: row.description,
    qty: String(row.qty),
    unit: row.unit,
    unitPriceCents: asNumber(row.unit_price_cents),
    position: asNumber(row.position),
    lineTotalCents: asNumber(row.line_total_cents),
  };
}

export async function createQuote(
  tx: Tx,
  input: {
    orgId: string;
    customerId: string;
    lines: Array<{
      articleId: string | null;
      description: string;
      qty: number;
      unit: string;
      unitPriceCents: number;
    }>;
  },
): Promise<{ id: string }> {
  const data = createQuoteInput.parse(input);
  const customers = await tx.query<{ id: string }>(
    `select id from customers where id = $1 and org_id = $2`,
    [data.customerId, input.orgId],
  );
  if (!customers[0]) throw new AppError("Klant niet gevonden.");

  const quoteId = crypto.randomUUID();
  await tx.query(
    `insert into quotes (id, org_id, customer_id, status) values ($1, $2, $3, 'draft')`,
    [quoteId, input.orgId, data.customerId],
  );

  for (const [index, line] of data.lines.entries()) {
    if (line.articleId) {
      const articles = await tx.query<{ id: string }>(
        `select id from articles where id = $1 and org_id = $2`,
        [line.articleId, input.orgId],
      );
      if (!articles[0]) throw new AppError("Artikel niet gevonden.");
    }
    await tx.query(
      `insert into quote_lines
         (id, org_id, quote_id, article_id, description, qty, unit, unit_price_cents, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        crypto.randomUUID(),
        input.orgId,
        quoteId,
        line.articleId,
        line.description,
        line.qty,
        line.unit,
        line.unitPriceCents,
        index + 1,
      ],
    );
  }

  await openDeal(tx, {
    orgId: input.orgId,
    quoteId,
    customerId: data.customerId,
  });
  return { id: quoteId };
}

export async function listQuotes(tx: Tx, orgId: string): Promise<QuoteSummary[]> {
  const rows = await tx.query<{
    id: string;
    number: string | null;
    status: QuoteSummary["status"];
    customer_name: string;
    total_cents: unknown;
    created_on: string;
  }>(
    `select q.id,
            q.number,
            q.status,
            c.name as customer_name,
            coalesce((
              select round(sum(l.qty * l.unit_price_cents))::int
                from quote_lines l
               where l.quote_id = q.id
            ), 0) as total_cents,
            to_char(q.created_at at time zone 'Europe/Amsterdam', 'DD-MM-YYYY') as created_on
       from quotes q
       join customers c on c.id = q.customer_id and c.org_id = q.org_id
      where q.org_id = $1
      order by q.created_at desc`,
    [orgId],
  );
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    customerName: row.customer_name,
    totalCents: asNumber(row.total_cents),
    createdOn: row.created_on,
  }));
}

async function loadLines(tx: Tx, orgId: string, quoteId: string): Promise<QuoteLine[]> {
  const rows = await tx.query<{
    id: string;
    article_id: string | null;
    description: string;
    qty: unknown;
    unit: string;
    unit_price_cents: unknown;
    position: unknown;
    line_total_cents: unknown;
  }>(
    `select id, article_id, description, qty::text as qty, unit, unit_price_cents, position,
            round(qty * unit_price_cents)::int as line_total_cents
       from quote_lines
      where quote_id = $1 and org_id = $2
      order by position asc`,
    [quoteId, orgId],
  );
  return rows.map(mapLine);
}

export async function getQuote(
  tx: Tx,
  orgId: string,
  quoteId: string,
): Promise<QuoteDetail | null> {
  const rows = await tx.query<{
    id: string;
    number: string | null;
    status: QuoteSummary["status"];
    customer_id: string;
    customer_name: string;
    created_on: string;
    order_id: string | null;
    order_number: string | null;
  }>(
    `select q.id,
            q.number,
            q.status,
            q.customer_id,
            c.name as customer_name,
            to_char(q.created_at at time zone 'Europe/Amsterdam', 'DD-MM-YYYY') as created_on,
            o.id as order_id,
            o.number as order_number
       from quotes q
       join customers c on c.id = q.customer_id and c.org_id = q.org_id
       left join orders o on o.quote_id = q.id and o.org_id = q.org_id
      where q.org_id = $1 and q.id = $2`,
    [orgId, quoteId],
  );
  const quote = rows[0];
  if (!quote) return null;
  const lines = await loadLines(tx, orgId, quoteId);
  return {
    id: quote.id,
    number: quote.number,
    status: quote.status,
    customerId: quote.customer_id,
    customerName: quote.customer_name,
    createdOn: quote.created_on,
    totalCents: lines.reduce((sum, line) => sum + line.lineTotalCents, 0),
    lines,
    orderId: quote.order_id,
    orderNumber: quote.order_number,
  };
}

export async function markQuoteSent(
  tx: Tx,
  input: { orgId: string; quoteId: string },
): Promise<{ id: string }> {
  const rows = await tx.query<{ id: string }>(
    `update quotes
        set status = 'sent'
      where id = $1 and org_id = $2 and status = 'draft'
      returning id`,
    [input.quoteId, input.orgId],
  );
  if (!rows[0]) throw new AppError("Alleen een concept kan als verzonden worden gemarkeerd.");
  return { id: rows[0].id };
}

export async function rejectQuote(
  tx: Tx,
  input: { orgId: string; quoteId: string },
): Promise<{ id: string }> {
  const rows = await tx.query<{ id: string }>(
    `update quotes
        set status = 'rejected'
      where id = $1 and org_id = $2 and status in ('draft', 'sent')
      returning id`,
    [input.quoteId, input.orgId],
  );
  if (!rows[0]) throw new AppError("Deze offerte kan niet worden afgewezen.");
  await loseDeal(tx, { orgId: input.orgId, quoteId: input.quoteId });
  return { id: rows[0].id };
}

/**
 * One transaction, started by the caller: quote accepted, deal won,
 * order confirmed, lines copied with their stored price.
 * OFF and ORD numbers are allocated here, per organisation.
 */
export async function acceptQuote(
  tx: Tx,
  input: { orgId: string; quoteId: string },
): Promise<{ quoteId: string; quoteNumber: string; orderId: string; orderNumber: string }> {
  const locked = await tx.query<{
    id: string;
    customer_id: string;
    status: string;
    number: string | null;
  }>(
    `select id, customer_id, status, number
       from quotes
      where id = $1 and org_id = $2
      for update`,
    [input.quoteId, input.orgId],
  );
  const quote = locked[0];
  if (!quote) throw new AppError("Offerte niet gevonden.");
  if (quote.status !== "draft" && quote.status !== "sent") {
    throw new AppError("Deze offerte kan niet meer geaccepteerd worden.");
  }

  const lines = await loadLines(tx, input.orgId, input.quoteId);
  if (lines.length === 0) throw new AppError("Een offerte zonder regels kan niet geaccepteerd worden.");

  const quoteNumber = quote.number ?? (await allocateQuoteNumber(tx, input.orgId));
  const deal = await winDeal(tx, { orgId: input.orgId, quoteId: input.quoteId });
  const order = await createFromQuote(tx, {
    orgId: input.orgId,
    quoteId: input.quoteId,
    dealId: deal.id,
    customerId: quote.customer_id,
    lines: lines.map((line) => ({
      description: line.description,
      qty: line.qty,
      unit: line.unit,
      unitPriceCents: line.unitPriceCents,
      position: line.position,
    })),
  });

  await tx.query(
    `update quotes
        set status = 'accepted', number = $3
      where id = $1 and org_id = $2`,
    [input.quoteId, input.orgId, quoteNumber],
  );

  return {
    quoteId: input.quoteId,
    quoteNumber,
    orderId: order.id,
    orderNumber: order.number,
  };
}
