import { z } from "zod";
import { parseQty } from "@/lib/money";

const money = z.number().int().nonnegative().max(100_000_000);

const qtyText = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((value) => {
    const parsed = parseQty(value);
    return parsed != null && parsed !== "0";
  }, "Aantal moet groter zijn dan nul.");

const dateText = z
  .string()
  .trim()
  .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), "Die datum bestaat niet.");

const supplierFields = {
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(160).default(""),
  notes: z.string().trim().max(500).default(""),
};

export const purchaseStatuses = ["draft", "ordered", "partial", "received", "cancelled"] as const;
export type PurchaseStatus = (typeof purchaseStatuses)[number];

export const purchaseStatusLabel: Record<PurchaseStatus, string> = {
  draft: "Concept",
  ordered: "Besteld",
  partial: "Deels binnen",
  received: "Binnen",
  cancelled: "Geannuleerd",
};

export const createSupplierInput = z.object(supplierFields);

export const updateSupplierInput = z.object({
  ...supplierFields,
  supplierId: z.uuid(),
  active: z.boolean(),
});

export const createPurchaseInput = z.object({
  supplierId: z.uuid(),
  expectedOn: dateText.default(""),
});

export const addPurchaseLineInput = z.object({
  purchaseId: z.uuid(),
  articleId: z.uuid(),
  qty: qtyText,
  unitCostCents: money,
});

export const removePurchaseLineInput = z.object({
  purchaseId: z.uuid(),
  lineId: z.uuid(),
});

export const purchaseIdInput = z.object({
  purchaseId: z.uuid(),
});

export const setExpectedInput = z.object({
  purchaseId: z.uuid(),
  expectedOn: dateText.refine((value) => value !== "", "Vul een leverdatum in."),
});

export const receiveLineInput = z.object({
  purchaseId: z.uuid(),
  lineId: z.uuid(),
  qty: qtyText,
});

export type Supplier = {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
};

export type PurchaseSummary = {
  id: string;
  number: string | null;
  status: PurchaseStatus;
  supplierName: string;
  expectedOn: string | null;
};

export type Arrival = {
  id: string;
  number: string;
  status: PurchaseStatus;
  supplierName: string;
  expectedOn: string;
  late: boolean;
};

export type PurchaseLine = {
  id: string;
  articleId: string;
  description: string;
  unit: string;
  qtyOrdered: string;
  qtyReceived: string;
  unitCostCents: number;
};

export type PurchaseDetail = {
  id: string;
  number: string | null;
  status: PurchaseStatus;
  supplierId: string;
  supplierName: string;
  expectedOn: string | null;
  lines: PurchaseLine[];
};

export type IncomingLine = {
  articleId: string;
  qtyOpen: string;
  expectedOn: string;
};

export type PurchasingBoard = {
  orders: PurchaseSummary[];
  suppliers: Supplier[];
  arrivals: Arrival[];
};
