import { z } from "zod";

export const quoteStatuses = ["draft", "sent", "accepted", "rejected"] as const;
export type QuoteStatus = (typeof quoteStatuses)[number];

export const quoteStatusLabel: Record<QuoteStatus, string> = {
  draft: "Concept",
  sent: "Verzonden",
  accepted: "Geaccepteerd",
  rejected: "Afgewezen",
};

export const quoteLineInput = z.object({
  articleId: z.uuid().nullable(),
  description: z.string().trim().min(1).max(300),
  qty: z.number().positive().max(1_000_000),
  unit: z.string().trim().min(1).max(20),
  unitPriceCents: z.number().int().nonnegative().max(100_000_000),
});

export const createQuoteInput = z.object({
  customerId: z.uuid(),
  lines: z.array(quoteLineInput).min(1).max(40),
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
  unitPriceCents: number;
  position: number;
  lineTotalCents: number;
};

export type QuoteSummary = {
  id: string;
  number: string | null;
  status: QuoteStatus;
  customerName: string;
  totalCents: number;
  createdOn: string;
};

export type QuoteDetail = QuoteSummary & {
  customerId: string;
  lines: QuoteLine[];
  orderId: string | null;
  orderNumber: string | null;
};
