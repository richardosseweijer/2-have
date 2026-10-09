import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { dealQuoteInput, openDealInput, type Deal } from "./boundary";

export async function openDeal(
  tx: Tx,
  input: { orgId: string; quoteId: string; customerId: string },
): Promise<Deal> {
  const data = openDealInput.parse(input);
  const id = crypto.randomUUID();
  await tx.query(
    `insert into deals (id, org_id, quote_id, customer_id, status)
     values ($1, $2, $3, $4, 'open')`,
    [id, data.orgId, data.quoteId, data.customerId],
  );
  return { id, quoteId: data.quoteId, customerId: data.customerId, status: "open" };
}

export async function winDeal(
  tx: Tx,
  input: { orgId: string; quoteId: string },
): Promise<Deal> {
  const data = dealQuoteInput.parse(input);
  const rows = await tx.query<{ id: string; customer_id: string }>(
    `update deals
        set status = 'won'
      where quote_id = $1 and org_id = $2 and status = 'open'
      returning id, customer_id`,
    [data.quoteId, data.orgId],
  );
  if (!rows[0]) throw new AppError("Er is geen open deal bij deze offerte.");
  return {
    id: rows[0].id,
    quoteId: data.quoteId,
    customerId: rows[0].customer_id,
    status: "won",
  };
}

export async function loseDeal(
  tx: Tx,
  input: { orgId: string; quoteId: string },
): Promise<Deal> {
  const data = dealQuoteInput.parse(input);
  const rows = await tx.query<{ id: string; customer_id: string }>(
    `update deals
        set status = 'lost'
      where quote_id = $1 and org_id = $2 and status = 'open'
      returning id, customer_id`,
    [data.quoteId, data.orgId],
  );
  if (!rows[0]) throw new AppError("Er is geen open deal bij deze offerte.");
  return {
    id: rows[0].id,
    quoteId: data.quoteId,
    customerId: rows[0].customer_id,
    status: "lost",
  };
}
