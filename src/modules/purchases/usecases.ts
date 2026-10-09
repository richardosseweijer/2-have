import { getArticle, receiveStock } from "../articles";
import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { asNumber, parseQty } from "@/lib/money";
import {
  addPurchaseLineInput,
  createPurchaseInput,
  createSupplierInput,
  purchaseIdInput,
  receiveLineInput,
  removePurchaseLineInput,
  setExpectedInput,
  updateSupplierInput,
  type Arrival,
  type IncomingLine,
  type PurchaseDetail,
  type PurchaseLine,
  type PurchaseStatus,
  type PurchaseSummary,
  type PurchasingBoard,
  type Supplier,
} from "./boundary";

const ARRIVAL_HORIZON_DAYS = 7;

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "23505") return true;
  const message = "message" in error ? String(error.message) : "";
  return /duplicate key|unique constraint/i.test(message);
}

function assertRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AppError("Die datum bestaat niet.");
  }
}

function optionalDate(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) throw new AppError("Die datum bestaat niet.");
  assertRealDate(trimmed);
  return trimmed;
}

async function allocateNumber(tx: Tx, orgId: string): Promise<string> {
  const rows = await tx.query<{ last_value: unknown }>(
    `insert into purchase_counters (org_id, last_value)
     values ($1, 1)
     on conflict (org_id) do update
       set last_value = purchase_counters.last_value + 1
     returning last_value`,
    [orgId],
  );
  return `INK-${String(asNumber(rows[0]?.last_value)).padStart(4, "0")}`;
}

function mapSupplier(row: {
  id: string;
  name: string;
  phone: string;
  email: string;
  notes: string;
  active: boolean;
}): Supplier {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    notes: row.notes,
    active: row.active,
  };
}

export async function listArrivals(tx: Tx, orgId: string): Promise<Arrival[]> {
  const rows = await tx.query<{
    id: string;
    number: string;
    status: PurchaseStatus;
    supplier_name: string;
    expected_on: string;
    late: string;
  }>(
    `select o.id, o.number, o.status, s.name as supplier_name,
            to_char(o.expected_on, 'YYYY-MM-DD') as expected_on,
            case when o.expected_on < current_date then 'yes' else 'no' end as late
       from purchase_orders o
       join suppliers s on s.id = o.supplier_id and s.org_id = o.org_id
      where o.org_id = $1
        and o.status in ('ordered', 'partial')
        and o.expected_on <= current_date + $2::int
      order by o.expected_on asc, o.number asc`,
    [orgId, ARRIVAL_HORIZON_DAYS],
  );
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    supplierName: row.supplier_name,
    expectedOn: row.expected_on,
    late: row.late === "yes",
  }));
}

export async function listIncoming(tx: Tx, orgId: string): Promise<IncomingLine[]> {
  const rows = await tx.query<{ article_id: string; qty_open: string; expected_on: string }>(
    `select l.article_id,
            (l.qty_ordered - l.qty_received)::text as qty_open,
            to_char(o.expected_on, 'YYYY-MM-DD') as expected_on
       from purchase_lines l
       join purchase_orders o on o.id = l.purchase_order_id and o.org_id = l.org_id
      where l.org_id = $1
        and o.status in ('ordered', 'partial')
        and l.qty_ordered > l.qty_received`,
    [orgId],
  );
  return rows.map((row) => ({
    articleId: row.article_id,
    qtyOpen: row.qty_open,
    expectedOn: row.expected_on,
  }));
}

export async function listPurchasing(tx: Tx, orgId: string): Promise<PurchasingBoard> {
  const orders = await tx.query<{
    id: string;
    number: string | null;
    status: PurchaseStatus;
    supplier_name: string;
    expected_on: string | null;
  }>(
    `select o.id, o.number, o.status, s.name as supplier_name,
            to_char(o.expected_on, 'YYYY-MM-DD') as expected_on
       from purchase_orders o
       join suppliers s on s.id = o.supplier_id and s.org_id = o.org_id
      where o.org_id = $1
      order by o.created_at desc`,
    [orgId],
  );
  const suppliers = await tx.query<{
    id: string;
    name: string;
    phone: string;
    email: string;
    notes: string;
    active: boolean;
  }>(
    `select id, name, phone, email, notes, active
       from suppliers
      where org_id = $1
      order by active desc, name asc`,
    [orgId],
  );
  return {
    orders: orders.map((row) => ({
      id: row.id,
      number: row.number,
      status: row.status,
      supplierName: row.supplier_name,
      expectedOn: row.expected_on,
    })),
    suppliers: suppliers.map(mapSupplier),
    arrivals: await listArrivals(tx, orgId),
  };
}

async function lockOrder(tx: Tx, orgId: string, purchaseId: string) {
  const rows = await tx.query<{
    id: string;
    status: PurchaseStatus;
    number: string | null;
    expected_on: string | null;
    supplier_id: string;
  }>(
    `select id, status, number, to_char(expected_on, 'YYYY-MM-DD') as expected_on, supplier_id
       from purchase_orders
      where id = $1 and org_id = $2
      for update`,
    [purchaseId, orgId],
  );
  const order = rows[0];
  if (!order) throw new AppError("Inkooporder niet gevonden.");
  return order;
}

export async function getPurchase(tx: Tx, orgId: string, purchaseId: string): Promise<PurchaseDetail | null> {
  const rows = await tx.query<{
    id: string;
    number: string | null;
    status: PurchaseStatus;
    supplier_id: string;
    supplier_name: string;
    expected_on: string | null;
  }>(
    `select o.id, o.number, o.status, o.supplier_id, s.name as supplier_name,
            to_char(o.expected_on, 'YYYY-MM-DD') as expected_on
       from purchase_orders o
       join suppliers s on s.id = o.supplier_id and s.org_id = o.org_id
      where o.org_id = $1 and o.id = $2`,
    [orgId, purchaseId],
  );
  const order = rows[0];
  if (!order) return null;
  const lines = await tx.query<{
    id: string;
    article_id: string;
    description: string;
    unit: string;
    qty_ordered: string;
    qty_received: string;
    unit_cost_cents: unknown;
  }>(
    `select id, article_id, description, unit,
            qty_ordered::text as qty_ordered, qty_received::text as qty_received, unit_cost_cents
       from purchase_lines
      where purchase_order_id = $1 and org_id = $2
      order by created_at asc`,
    [purchaseId, orgId],
  );
  return {
    id: order.id,
    number: order.number,
    status: order.status,
    supplierId: order.supplier_id,
    supplierName: order.supplier_name,
    expectedOn: order.expected_on,
    lines: lines.map(mapLine),
  };
}

function mapLine(row: {
  id: string;
  article_id: string;
  description: string;
  unit: string;
  qty_ordered: string;
  qty_received: string;
  unit_cost_cents: unknown;
}): PurchaseLine {
  return {
    id: row.id,
    articleId: row.article_id,
    description: row.description,
    unit: row.unit,
    qtyOrdered: row.qty_ordered,
    qtyReceived: row.qty_received,
    unitCostCents: asNumber(row.unit_cost_cents),
  };
}

export async function createSupplier(
  tx: Tx,
  input: { orgId: string; name: string; phone?: string; email?: string; notes?: string },
): Promise<Supplier> {
  const data = createSupplierInput.parse(input);
  const id = crypto.randomUUID();
  try {
    await tx.query(
      `insert into suppliers (id, org_id, name, phone, email, notes)
       values ($1, $2, $3, $4, $5, $6)`,
      [id, input.orgId, data.name, data.phone, data.email, data.notes],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("Die leverancier bestaat al.");
    throw error;
  }
  return { id, name: data.name, phone: data.phone, email: data.email, notes: data.notes, active: true };
}

export async function updateSupplier(
  tx: Tx,
  input: {
    orgId: string;
    supplierId: string;
    name: string;
    phone: string;
    email: string;
    notes: string;
    active: boolean;
  },
): Promise<void> {
  const data = updateSupplierInput.parse(input);
  try {
    const rows = await tx.query<{ id: string }>(
      `update suppliers
          set name = $3, phone = $4, email = $5, notes = $6, active = $7
        where id = $1 and org_id = $2
        returning id`,
      [data.supplierId, input.orgId, data.name, data.phone, data.email, data.notes, data.active],
    );
    if (!rows[0]) throw new AppError("Leverancier niet gevonden.");
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("Die leverancier bestaat al.");
    throw error;
  }
}

export async function createPurchase(
  tx: Tx,
  input: { orgId: string; supplierId: string; expectedOn?: string },
): Promise<{ id: string }> {
  const data = createPurchaseInput.parse(input);
  const expectedOn = optionalDate(data.expectedOn);
  const supplier = await tx.query<{ id: string }>(
    `select id from suppliers where id = $1 and org_id = $2 and active`,
    [data.supplierId, input.orgId],
  );
  if (!supplier[0]) throw new AppError("Kies een actieve leverancier.");
  const id = crypto.randomUUID();
  await tx.query(
    `insert into purchase_orders (id, org_id, supplier_id, status, expected_on)
     values ($1, $2, $3, 'draft', $4)`,
    [id, input.orgId, data.supplierId, expectedOn],
  );
  return { id };
}

export async function addPurchaseLine(
  tx: Tx,
  input: { orgId: string; purchaseId: string; articleId: string; qty: string; unitCostCents: number },
): Promise<void> {
  const data = addPurchaseLineInput.parse(input);
  const qty = parseQty(data.qty);
  if (qty == null || qty === "0") throw new AppError("Aantal moet groter zijn dan nul.");
  const order = await lockOrder(tx, input.orgId, data.purchaseId);
  if (order.status !== "draft") throw new AppError("Regels wijzigen kan alleen in een concept.");
  const article = await getArticle(tx, input.orgId, data.articleId);
  if (!article) throw new AppError("Artikel niet gevonden.");
  await tx.query(
    `insert into purchase_lines
       (id, org_id, purchase_order_id, article_id, description, unit, qty_ordered, unit_cost_cents)
     values ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      crypto.randomUUID(),
      input.orgId,
      data.purchaseId,
      article.id,
      article.name,
      article.unit,
      qty,
      data.unitCostCents,
    ],
  );
}

export async function removePurchaseLine(
  tx: Tx,
  input: { orgId: string; purchaseId: string; lineId: string },
): Promise<void> {
  const data = removePurchaseLineInput.parse(input);
  const order = await lockOrder(tx, input.orgId, data.purchaseId);
  if (order.status !== "draft") throw new AppError("Regels wijzigen kan alleen in een concept.");
  const rows = await tx.query<{ id: string }>(
    `delete from purchase_lines
      where id = $1 and purchase_order_id = $2 and org_id = $3
      returning id`,
    [data.lineId, data.purchaseId, input.orgId],
  );
  if (!rows[0]) throw new AppError("Regel niet gevonden.");
}

export async function setPurchaseExpected(
  tx: Tx,
  input: { orgId: string; purchaseId: string; expectedOn: string },
): Promise<void> {
  const data = setExpectedInput.parse(input);
  const expectedOn = optionalDate(data.expectedOn);
  if (!expectedOn) throw new AppError("Vul een leverdatum in.");
  const order = await lockOrder(tx, input.orgId, data.purchaseId);
  if (order.status === "received" || order.status === "cancelled") {
    throw new AppError("De leverdatum van deze order staat vast.");
  }
  await tx.query(
    `update purchase_orders set expected_on = $3 where id = $1 and org_id = $2`,
    [data.purchaseId, input.orgId, expectedOn],
  );
}

export async function placePurchase(tx: Tx, input: { orgId: string; purchaseId: string }): Promise<void> {
  const data = purchaseIdInput.parse(input);
  const order = await lockOrder(tx, input.orgId, data.purchaseId);
  if (order.status !== "draft") throw new AppError("Deze order is al geplaatst.");
  if (!order.expected_on) throw new AppError("Vul een leverdatum in.");
  const supplier = await tx.query<{ id: string }>(
    `select id from suppliers where id = $1 and org_id = $2 and active`,
    [order.supplier_id, input.orgId],
  );
  if (!supplier[0]) throw new AppError("De leverancier is niet meer actief.");
  const lines = await tx.query<{ id: string }>(
    `select id from purchase_lines where purchase_order_id = $1 and org_id = $2`,
    [data.purchaseId, input.orgId],
  );
  if (lines.length === 0) throw new AppError("Een order zonder regels kan niet geplaatst worden.");
  const number = await allocateNumber(tx, input.orgId);
  await tx.query(
    `update purchase_orders
        set status = 'ordered', number = $3
      where id = $1 and org_id = $2 and status = 'draft'`,
    [data.purchaseId, input.orgId, number],
  );
}

export async function receivePurchaseLine(
  tx: Tx,
  input: { orgId: string; purchaseId: string; lineId: string; qty: string },
): Promise<void> {
  const data = receiveLineInput.parse(input);
  const qty = parseQty(data.qty);
  if (qty == null || qty === "0") throw new AppError("Aantal moet groter zijn dan nul.");
  const order = await lockOrder(tx, input.orgId, data.purchaseId);
  if (order.status !== "ordered" && order.status !== "partial") {
    throw new AppError("Alleen een geplaatste order kan binnenkomen.");
  }
  const updated = await tx.query<{ article_id: string }>(
    `update purchase_lines
        set qty_received = qty_received + $4::numeric
      where id = $1 and purchase_order_id = $2 and org_id = $3
        and qty_received + $4::numeric <= qty_ordered
      returning article_id`,
    [data.lineId, data.purchaseId, input.orgId, qty],
  );
  const line = updated[0];
  if (!line) throw new AppError("Meer dan er open staat kan niet.");
  await receiveStock(tx, { orgId: input.orgId, articleId: line.article_id, qty });
  await tx.query(
    `update purchase_orders
        set status = case
          when exists (
            select 1 from purchase_lines
             where purchase_order_id = $1 and org_id = $2 and qty_received < qty_ordered
          ) then 'partial'
          else 'received'
        end
      where id = $1 and org_id = $2`,
    [data.purchaseId, input.orgId],
  );
}

export async function cancelPurchase(tx: Tx, input: { orgId: string; purchaseId: string }): Promise<void> {
  const data = purchaseIdInput.parse(input);
  const order = await lockOrder(tx, input.orgId, data.purchaseId);
  if (order.status !== "draft" && order.status !== "ordered" && order.status !== "partial") {
    throw new AppError("Deze order kan niet meer geannuleerd worden.");
  }
  await tx.query(
    `update purchase_orders set status = 'cancelled' where id = $1 and org_id = $2`,
    [data.purchaseId, input.orgId],
  );
}
