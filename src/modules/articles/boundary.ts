import { z } from "zod";

export const UNITS = ["stuk", "uur", "m", "m²", "kg"] as const;

export const createArticleInput = z.object({
  name: z.string().trim().min(1).max(160),
  unit: z.enum(UNITS),
  unitPriceCents: z.number().int().nonnegative().max(100_000_000),
});

export const updateArticlePriceInput = z.object({
  articleId: z.uuid(),
  unitPriceCents: z.number().int().nonnegative().max(100_000_000),
});

export type Article = {
  id: string;
  name: string;
  unit: string;
  unitPriceCents: number;
};
