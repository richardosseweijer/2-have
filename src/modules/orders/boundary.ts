import { z } from "zod";

export const copiedLineSchema = z.object({
  description: z.string().trim().min(1).max(300),
  qty: z.string().regex(/^\d+(\.\d+)?$/),
  unit: z.string().trim().min(1).max(20),
  unitPriceCents: z.number().int().nonnegative(),
  position: z.number().int().positive(),
});

export const createFromQuoteInput = z.object({
  orgId: z.uuid(),
  quoteId: z.uuid(),
  dealId: z.uuid(),
  customerId: z.uuid(),
  lines: z.array(copiedLineSchema).min(1),
});

export type OrderLine = {
  id: string;
  description: string;
  qty: string;
  unit: string;
  unitPriceCents: number;
  position: number;
  lineTotalCents: number;
};

export type OrderSummary = {
  id: string;
  number: string;
  status: "confirmed" | "in_progress" | "done" | "cancelled";
  customerName: string;
  quoteNumber: string | null;
  totalCents: number;
  createdOn: string;
};

export type OrderDetail = OrderSummary & {
  quoteId: string;
  lines: OrderLine[];
};
