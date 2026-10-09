import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { asNumber, parseQty } from "@/lib/money";
import {
  createArticleInput,
  createCategoryInput,
  deleteCategoryInput,
  renameCategoryInput,
  updateArticleInput,
  updateArticlePriceInput,
  type Article,
  type Category,
} from "./boundary";

type ArticleRow = {
  id: string;
  name: string;
  unit: string;
  cost_cents: unknown;
  unit_price_cents: unknown;
  min_qty: string;
  on_hand: string;
  qty_needed: string;
  qty_underway: string;
  categories: unknown;
};

const articleSelect = `
  select a.id, a.name, a.unit, a.cost_cents, a.unit_price_cents, a.min_qty::text as min_qty,
         coalesce(
           json_agg(json_build_object('id', c.id, 'name', c.name) order by c.name)
             filter (where c.id is not null),
           '[]'::json
         )::text as categories,
         coalesce((select b.on_hand from stock_balances b where b.article_id = a.id and b.org_id = a.org_id), 0)::text as on_hand,
         coalesce((
           select sum(d.qty_needed - d.qty_issued)
             from project_demands d
             join projects p on p.id = d.project_id and p.org_id = d.org_id
            where d.article_id = a.id
              and d.org_id = a.org_id
              and p.status not in ('done', 'cancelled')
         ), 0)::text as qty_needed,
         coalesce((
           select sum(l.qty_ordered - l.qty_received)
             from purchase_lines l
             join purchase_orders o on o.id = l.purchase_order_id and o.org_id = l.org_id
            where l.article_id = a.id
              and l.org_id = a.org_id
              and o.status in ('ordered', 'partial')
         ), 0)::text as qty_underway
    from articles a
    left join article_category_links l on l.article_id = a.id and l.org_id = a.org_id
    left join article_categories c on c.id = l.category_id and c.org_id = a.org_id
`;

function mapCategories(value: unknown): Category[] {
  const parsed = typeof value === "string" ? JSON.parse(value) : value;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item: { id: unknown; name: unknown }) => ({
    id: String(item.id),
    name: String(item.name),
  }));
}

function mapArticle(row: ArticleRow): Article {
  const minQty = parseQty(row.min_qty);
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    costCents: asNumber(row.cost_cents),
    unitPriceCents: asNumber(row.unit_price_cents),
    minQty: minQty ?? row.min_qty,
    onHand: row.on_hand,
    qtyNeeded: row.qty_needed,
    qtyUnderway: row.qty_underway,
    categories: mapCategories(row.categories),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "23505") return true;
  const message = "message" in error ? String(error.message) : "";
  return /duplicate key|unique constraint/i.test(message);
}

async function requireArticle(tx: Tx, orgId: string, articleId: string): Promise<Article> {
  const rows = await tx.query<ArticleRow>(
    `${articleSelect}
      where a.org_id = $1 and a.id = $2
      group by a.id, a.name, a.unit, a.cost_cents, a.unit_price_cents, a.min_qty`,
    [orgId, articleId],
  );
  if (!rows[0]) throw new AppError("Artikel niet gevonden.");
  return mapArticle(rows[0]);
}

async function replaceCategories(tx: Tx, orgId: string, articleId: string, categoryIds: string[]) {
  const unique = [...new Set(categoryIds)];
  await tx.query(`delete from article_category_links where article_id = $1 and org_id = $2`, [
    articleId,
    orgId,
  ]);
  for (const categoryId of unique) {
    const linked = await tx.query<{ category_id: string }>(
      `insert into article_category_links (article_id, category_id, org_id)
       select $1, id, org_id
         from article_categories
        where id = $2 and org_id = $3
       returning category_id`,
      [articleId, categoryId, orgId],
    );
    if (!linked[0]) throw new AppError("Categorie niet gevonden.");
  }
}

export async function listCategories(tx: Tx, orgId: string): Promise<Category[]> {
  return tx.query<Category>(
    `select id, name
       from article_categories
      where org_id = $1
      order by name asc`,
    [orgId],
  );
}

export async function createCategory(
  tx: Tx,
  input: { orgId: string; name: string },
): Promise<Category> {
  const data = createCategoryInput.parse(input);
  try {
    const rows = await tx.query<Category>(
      `insert into article_categories (id, org_id, name)
       values ($1, $2, $3)
       returning id, name`,
      [crypto.randomUUID(), input.orgId, data.name],
    );
    return rows[0];
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("Die categorie bestaat al.");
    throw error;
  }
}

export async function renameCategory(
  tx: Tx,
  input: { orgId: string; categoryId: string; name: string },
): Promise<Category> {
  const data = renameCategoryInput.parse(input);
  try {
    const rows = await tx.query<Category>(
      `update article_categories
          set name = $3
        where id = $1 and org_id = $2
       returning id, name`,
      [data.categoryId, input.orgId, data.name],
    );
    if (!rows[0]) throw new AppError("Categorie niet gevonden.");
    return rows[0];
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) throw new AppError("Die categorie bestaat al.");
    throw error;
  }
}

export async function deleteCategory(
  tx: Tx,
  input: { orgId: string; categoryId: string },
): Promise<void> {
  const data = deleteCategoryInput.parse(input);
  const rows = await tx.query<{ id: string }>(
    `delete from article_categories
      where id = $1 and org_id = $2
      returning id`,
    [data.categoryId, input.orgId],
  );
  if (!rows[0]) throw new AppError("Categorie niet gevonden.");
}

export async function createArticle(
  tx: Tx,
  input: {
    orgId: string;
    name: string;
    unit: string;
    costCents?: number;
    unitPriceCents: number;
    minQty?: string;
    categoryIds?: string[];
  },
): Promise<Article> {
  const data = createArticleInput.parse(input);
  const minQty = parseQty(data.minQty);
  if (minQty == null) throw new AppError("Ongeldige hoeveelheid.");
  const id = crypto.randomUUID();
  await tx.query(
    `insert into articles (id, org_id, name, unit, cost_cents, unit_price_cents, min_qty)
     values ($1, $2, $3, $4, $5, $6, $7)`,
    [id, input.orgId, data.name, data.unit, data.costCents, data.unitPriceCents, minQty],
  );
  await replaceCategories(tx, input.orgId, id, data.categoryIds);
  return requireArticle(tx, input.orgId, id);
}

export async function listArticles(tx: Tx, orgId: string): Promise<Article[]> {
  const rows = await tx.query<ArticleRow>(
    `${articleSelect}
      where a.org_id = $1
      group by a.id, a.name, a.unit, a.cost_cents, a.unit_price_cents, a.min_qty
      order by a.name asc`,
    [orgId],
  );
  return rows.map(mapArticle);
}

export async function getArticle(
  tx: Tx,
  orgId: string,
  articleId: string,
): Promise<Article | null> {
  const rows = await tx.query<ArticleRow>(
    `${articleSelect}
      where a.org_id = $1 and a.id = $2
      group by a.id, a.name, a.unit, a.cost_cents, a.unit_price_cents, a.min_qty`,
    [orgId, articleId],
  );
  return rows[0] ? mapArticle(rows[0]) : null;
}

export async function updateArticle(
  tx: Tx,
  input: {
    orgId: string;
    articleId: string;
    name: string;
    unit: string;
    costCents: number;
    unitPriceCents: number;
    minQty: string;
    categoryIds: string[];
  },
): Promise<Article> {
  const data = updateArticleInput.parse(input);
  const minQty = parseQty(data.minQty);
  if (minQty == null) throw new AppError("Ongeldige hoeveelheid.");
  const rows = await tx.query<{ id: string }>(
    `update articles
        set name = $3, unit = $4, cost_cents = $5, unit_price_cents = $6, min_qty = $7
      where id = $1 and org_id = $2
      returning id`,
    [data.articleId, input.orgId, data.name, data.unit, data.costCents, data.unitPriceCents, minQty],
  );
  if (!rows[0]) throw new AppError("Artikel niet gevonden.");
  await replaceCategories(tx, input.orgId, data.articleId, data.categoryIds);
  return requireArticle(tx, input.orgId, data.articleId);
}

/**
 * Changes the article's current sell price only.
 * Cost, minimum, categories, quote lines, and order lines stay as they are.
 */
export async function updateArticlePrice(
  tx: Tx,
  input: { orgId: string; articleId: string; unitPriceCents: number },
): Promise<Article> {
  const data = updateArticlePriceInput.parse({
    articleId: input.articleId,
    unitPriceCents: input.unitPriceCents,
  });
  const rows = await tx.query<{ id: string }>(
    `update articles
        set unit_price_cents = $3
      where id = $1 and org_id = $2
      returning id`,
    [data.articleId, input.orgId, data.unitPriceCents],
  );
  if (!rows[0]) throw new AppError("Artikel niet gevonden.");
  return requireArticle(tx, input.orgId, data.articleId);
}

async function moveStock(
  tx: Tx,
  input: {
    orgId: string;
    articleId: string;
    delta: string;
    kind: "receipt" | "issue" | "adjust";
    projectId?: string | null;
    note?: string;
  },
): Promise<void> {
  const article = await tx.query<{ id: string }>(
    `select id from articles where id = $1 and org_id = $2`,
    [input.articleId, input.orgId],
  );
  if (!article[0]) throw new AppError("Artikel niet gevonden.");
  await tx.query(
    `insert into stock_balances (article_id, org_id, on_hand)
     values ($1, $2, 0)
     on conflict (article_id) do nothing`,
    [input.articleId, input.orgId],
  );
  const locked = await tx.query<{ on_hand: string }>(
    `select on_hand::text as on_hand
       from stock_balances
      where article_id = $1 and org_id = $2
      for update`,
    [input.articleId, input.orgId],
  );
  const next = await tx.query<{ on_hand: string; negative: boolean }>(
    `select ($1::numeric + $2::numeric)::text as on_hand,
            ($1::numeric + $2::numeric) < 0 as negative`,
    [locked[0]?.on_hand ?? "0", input.delta],
  );
  if (!next[0] || next[0].negative) throw new AppError("Niet genoeg op voorraad.");
  await tx.query(
    `update stock_balances set on_hand = $3::numeric where article_id = $1 and org_id = $2`,
    [input.articleId, input.orgId, next[0].on_hand],
  );
  await tx.query(
    `insert into stock_movements (id, org_id, article_id, qty, kind, project_id, note)
     values ($1, $2, $3, $4::numeric, $5, $6, $7)`,
    [
      crypto.randomUUID(),
      input.orgId,
      input.articleId,
      input.delta,
      input.kind,
      input.projectId ?? null,
      input.note ?? "",
    ],
  );
}

export async function receiveStock(
  tx: Tx,
  input: { orgId: string; articleId: string; qty: string },
): Promise<void> {
  const qty = parseQty(input.qty);
  if (qty == null || qty === "0") throw new AppError("Aantal moet groter zijn dan nul.");
  await moveStock(tx, { orgId: input.orgId, articleId: input.articleId, delta: qty, kind: "receipt" });
}

export async function issueStock(
  tx: Tx,
  input: { orgId: string; articleId: string; qty: string; projectId: string },
): Promise<void> {
  const qty = parseQty(input.qty);
  if (qty == null || qty === "0") throw new AppError("Aantal moet groter zijn dan nul.");
  await moveStock(tx, {
    orgId: input.orgId,
    articleId: input.articleId,
    delta: `-${qty}`,
    kind: "issue",
    projectId: input.projectId,
  });
}

/** Sets the shelf to a counted quantity. A matching count writes nothing. */
export async function adjustStock(
  tx: Tx,
  input: { orgId: string; articleId: string; counted: string },
): Promise<void> {
  const counted = parseQty(input.counted === "" ? "0" : input.counted);
  if (counted == null) throw new AppError("Ongeldige hoeveelheid.");
  const article = await tx.query<{ id: string }>(
    `select id from articles where id = $1 and org_id = $2`,
    [input.articleId, input.orgId],
  );
  if (!article[0]) throw new AppError("Artikel niet gevonden.");
  await tx.query(
    `insert into stock_balances (article_id, org_id, on_hand)
     values ($1, $2, 0)
     on conflict (article_id) do nothing`,
    [input.articleId, input.orgId],
  );
  const current = await tx.query<{ on_hand: string }>(
    `select on_hand::text as on_hand
       from stock_balances
      where article_id = $1 and org_id = $2
      for update`,
    [input.articleId, input.orgId],
  );
  const delta = await tx.query<{ delta: string; same: boolean }>(
    `select ($1::numeric - $2::numeric)::text as delta,
            ($1::numeric - $2::numeric) = 0 as same`,
    [counted, current[0]?.on_hand ?? "0"],
  );
  if (!delta[0] || delta[0].same) return;
  await moveStock(tx, {
    orgId: input.orgId,
    articleId: input.articleId,
    delta: delta[0].delta,
    kind: "adjust",
    note: "Telling",
  });
}
