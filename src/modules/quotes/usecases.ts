import { loseDeal, openDeal, winDeal } from "../deals";
import { createFromQuote } from "../orders";
import { getArticle } from "../articles";
import { getCustomer } from "../customers";
import { createFromAcceptedQuote } from "../projects";
import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { applyMarkup, asNumber } from "@/lib/money";
import {
  createQuoteInput,
  updateQuotePricingInput,
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
  cost_cents: unknown;
  markup_bps: unknown;
  unit_price_cents: unknown;
  position: unknown;
  line_total_cents: unknown;
  margin_cents: unknown;
}): QuoteLine {
  return {
    id: row.id,
    articleId: row.article_id,
    description: row.description,
    qty: String(row.qty),
    unit: row.unit,
    costCents: asNumber(row.cost_cents),
    markupBps: row.markup_bps == null ? null : asNumber(row.markup_bps),
    unitPriceCents: asNumber(row.unit_price_cents),
    position: asNumber(row.position),
    lineTotalCents: asNumber(row.line_total_cents),
    marginCents: asNumber(row.margin_cents),
  };
}

function sellForInheritedLine(costCents: number, quoteMarkupBps: number, typedSellCents: number): number {
  if (costCents <= 0) return typedSellCents;
  return applyMarkup(costCents, quoteMarkupBps);
}

export async function createQuote(
  tx: Tx,
  input: {
    orgId: string;
    defaultMarkupBps: number;
    customerId: string;
    lines: Array<{
      articleId: string | null;
      description: string;
      qty: number;
      unit: string;
      costCents?: number;
      markupBps?: number | null;
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

  const quoteMarkupBps = input.defaultMarkupBps;
  if (!Number.isInteger(quoteMarkupBps) || quoteMarkupBps < 0 || quoteMarkupBps > 100_000) {
    throw new AppError("De standaardopslag van de organisatie klopt niet.");
  }

  const quoteId = crypto.randomUUID();
  await tx.query(
    `insert into quotes (id, org_id, customer_id, status, markup_bps) values ($1, $2, $3, 'draft', $4)`,
    [quoteId, input.orgId, data.customerId, quoteMarkupBps],
  );

  for (const [index, line] of data.lines.entries()) {
    let costCents = line.costCents ?? 0;
    if (line.articleId) {
      const article = await getArticle(tx, input.orgId, line.articleId);
      if (!article) throw new AppError("Artikel niet gevonden.");
      if (line.costCents == null) costCents = article.costCents;
    }
    const markupBps = line.markupBps === undefined ? null : line.markupBps;
    const unitPriceCents =
      markupBps == null
        ? sellForInheritedLine(costCents, quoteMarkupBps, line.unitPriceCents)
        : line.unitPriceCents;
    await tx.query(
      `insert into quote_lines
         (id, org_id, quote_id, article_id, description, qty, unit, cost_cents, markup_bps, unit_price_cents, position)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        crypto.randomUUID(),
        input.orgId,
        quoteId,
        line.articleId,
        line.description,
        line.qty,
        line.unit,
        costCents,
        markupBps,
        unitPriceCents,
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
    margin_cents: unknown;
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
            coalesce((
              select round(sum(l.qty * (l.unit_price_cents - l.cost_cents)))::int
                from quote_lines l
               where l.quote_id = q.id
            ), 0) as margin_cents,
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
    marginCents: asNumber(row.margin_cents),
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
    cost_cents: unknown;
    markup_bps: unknown;
    unit_price_cents: unknown;
    position: unknown;
    line_total_cents: unknown;
    margin_cents: unknown;
  }>(
    `select id, article_id, description, qty::text as qty, unit,
            cost_cents, markup_bps, unit_price_cents, position,
            round(qty * unit_price_cents)::int as line_total_cents,
            round(qty * (unit_price_cents - cost_cents))::int as margin_cents
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
    markup_bps: unknown;
    created_on: string;
    order_id: string | null;
    order_number: string | null;
  }>(
    `select q.id,
            q.number,
            q.status,
            q.customer_id,
            c.name as customer_name,
            q.markup_bps,
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
    marginCents: lines.reduce((sum, line) => sum + line.marginCents, 0),
    markupBps: asNumber(quote.markup_bps),
    lines,
    orderId: quote.order_id,
    orderNumber: quote.order_number,
  };
}

/**
 * Rewrites markup only while the quote is draft or sent.
 * A line with no own markup takes the quote percentage when its cost is above zero.
 * An explicit line markup keeps the sell price the caller stored.
 */
export async function updateQuotePricing(
  tx: Tx,
  input: {
    orgId: string;
    quoteId: string;
    markupBps: number;
    lines: Array<{
      lineId: string;
      costCents: number;
      markupBps: number | null;
      unitPriceCents: number;
    }>;
  },
): Promise<QuoteDetail> {
  const data = updateQuotePricingInput.parse(input);
  const locked = await tx.query<{ id: string; status: string }>(
    `select id, status
       from quotes
      where id = $1 and org_id = $2
      for update`,
    [data.quoteId, input.orgId],
  );
  const quote = locked[0];
  if (!quote) throw new AppError("Offerte niet gevonden.");
  if (quote.status !== "draft" && quote.status !== "sent") {
    throw new AppError("Een afgesloten offerte kan niet meer worden herberekend.");
  }

  const existing = await tx.query<{ id: string }>(
    `select id from quote_lines where quote_id = $1 and org_id = $2`,
    [data.quoteId, input.orgId],
  );
  const existingIds = new Set(existing.map((row) => row.id));
  if (existingIds.size !== data.lines.length || data.lines.some((line) => !existingIds.has(line.lineId))) {
    throw new AppError("De regels van deze offerte kloppen niet.");
  }

  await tx.query(`update quotes set markup_bps = $3 where id = $1 and org_id = $2`, [
    data.quoteId,
    input.orgId,
    data.markupBps,
  ]);

  for (const line of data.lines) {
    const unitPriceCents =
      line.markupBps == null
        ? sellForInheritedLine(line.costCents, data.markupBps, line.unitPriceCents)
        : line.unitPriceCents;
    await tx.query(
      `update quote_lines
          set cost_cents = $4, markup_bps = $5, unit_price_cents = $6
        where id = $1 and quote_id = $2 and org_id = $3`,
      [line.lineId, data.quoteId, input.orgId, line.costCents, line.markupBps, unitPriceCents],
    );
  }

  const updated = await getQuote(tx, input.orgId, data.quoteId);
  if (!updated) throw new AppError("Offerte niet gevonden.");
  return updated;
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
): Promise<{ quoteId: string; quoteNumber: string; orderId: string; orderNumber: string; projectId: string }> {
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

  const customer = await getCustomer(tx, input.orgId, quote.customer_id);
  if (!customer) throw new AppError("Klant niet gevonden.");
  const project = await createFromAcceptedQuote(tx, {
    orgId: input.orgId,
    quoteId: input.quoteId,
    orderId: order.id,
    customerId: quote.customer_id,
    quoteNumber,
    customerName: customer.name,
    lines: lines.map((line) => ({
      id: line.id,
      articleId: line.articleId,
      description: line.description,
      qty: line.qty,
      unit: line.unit,
    })),
  });

  return {
    quoteId: input.quoteId,
    quoteNumber,
    orderId: order.id,
    orderNumber: order.number,
    projectId: project.id,
  };
}
