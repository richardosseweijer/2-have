import { z } from "zod";
import { parseQty } from "@/lib/money";

export const UNITS = ["stuk", "uur", "m", "m²", "kg"] as const;

const money = z.number().int().nonnegative().max(100_000_000);
const categoryIds = z.array(z.uuid()).max(30);

const qtyText = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((value) => parseQty(value) != null, "Ongeldige hoeveelheid.");

export const createArticleInput = z.object({
  name: z.string().trim().min(1).max(160),
  unit: z.enum(UNITS),
  costCents: money.default(0),
  unitPriceCents: money,
  minQty: qtyText.default("0"),
  categoryIds: categoryIds.default([]),
});

export const updateArticleInput = z.object({
  articleId: z.uuid(),
  name: z.string().trim().min(1).max(160),
  unit: z.enum(UNITS),
  costCents: money,
  unitPriceCents: money,
  minQty: qtyText,
  categoryIds: categoryIds,
});

export const updateArticlePriceInput = z.object({
  articleId: z.uuid(),
  unitPriceCents: money,
});

export const createCategoryInput = z.object({
  name: z.string().trim().min(1).max(80),
});

export const renameCategoryInput = z.object({
  categoryId: z.uuid(),
  name: z.string().trim().min(1).max(80),
});

export const deleteCategoryInput = z.object({
  categoryId: z.uuid(),
});

export type Category = {
  id: string;
  name: string;
};

export type Article = {
  id: string;
  name: string;
  unit: string;
  costCents: number;
  unitPriceCents: number;
  minQty: string;
  onHand: string;
  qtyNeeded: string;
  qtyUnderway: string;
  categories: Category[];
};
