import { z } from "zod";

export const quoteStatuses = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  draft: "Concept",
  sent: "Verzonden",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
};

const money = z.number().int().nonnegative().max(100_000_000);
const quoteMarkup = z.number().int().min(0).max(100_000);
const lineMarkup = z.number().int().min(-10_000).max(100_000).nullable();

export const quoteLineInput = z.object({
  articleId: z.uuid().nullable(),
  description: z.string().trim().min(1).max(300),
  qty: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(20),
  costCents: money.optional(),
  markupBps: lineMarkup.optional(),
  unitPriceCents: money,
});

export const createQuoteInput = z.object({
  customerId: z.uuid(),
  lines: z.array(quoteLineInput).min(1).max(40),
});

export const updateQuotePricingInput = z.object({
  quoteId: z.uuid(),
  markupBps: quoteMarkup,
  lines: z
    .array(
      z.object({
        lineId: z.uuid(),
        costCents: money,
        markupBps: lineMarkup,
        unitPriceCents: money,
      }),
    )
    .min(1)
    .max(40),
});

export const quoteIdInput = z.object({
  id: z.uuid(),
});

export type QuoteLine = {
  id: string;
  articleId: string | null;
  description: string;
  qty: string;
  unit: string;
  costCents: number;
  markupBps: number | null;
  unitPriceCents: number;
  position: number;
  lineTotalCents: number;
  marginCents: number;
};

export type QuoteSummary = {
  id: string;
  number: string | null;
  status: QuoteStatus;
  customerName: string;
  totalCents: number;
  marginCents: number;
  createdOn: string;
};

export type QuoteDetail = QuoteSummary & {
  customerId: string;
  markupBps: number;
  lines: QuoteLine[];
  orderId: string | null;
  orderNumber: string | null;
};
