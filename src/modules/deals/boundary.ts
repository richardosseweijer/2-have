import { z } from "zod";

export const openDealInput = z.object({
  orgId: z.uuid(),
  quoteId: z.uuid(),
  customerId: z.uuid(),
});

export const dealQuoteInput = z.object({
  orgId: z.uuid(),
  quoteId: z.uuid(),
});

export type Deal = {
  id: string;
  quoteId: string;
  customerId: string;
  status: "open" | "won" | "lost";
};
