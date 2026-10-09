import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { asNumber } from "@/lib/money";
import { createArticleInput, updateArticlePriceInput, type Article } from "./boundary";

function mapArticle(row: {
  id: string;
  name: string;
  unit: string;
  unit_price_cents: unknown;
}): Article {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    unitPriceCents: asNumber(row.unit_price_cents),
  };
}

export async function createArticle(
  tx: Tx,
  input: { orgId: string; name: string; unit: string; unitPriceCents: number },
): Promise<Article> {
  const data = createArticleInput.parse(input);
  const id = crypto.randomUUID();
  await tx.query(
    `insert into articles (id, org_id, name, unit, unit_price_cents)
     values ($1, $2, $3, $4, $5)`,
    [id, input.orgId, data.name, data.unit, data.unitPriceCents],
  );
  return { id, name: data.name, unit: data.unit, unitPriceCents: data.unitPriceCents };
}

export async function listArticles(tx: Tx, orgId: string): Promise<Article[]> {
  const rows = await tx.query<{
    id: string;
    name: string;
    unit: string;
    unit_price_cents: unknown;
  }>(
    `select id, name, unit, unit_price_cents
       from articles
      where org_id = $1
      order by name asc`,
    [orgId],
  );
  return rows.map(mapArticle);
}

export async function getArticle(
  tx: Tx,
  orgId: string,
  articleId: string,
): Promise<Article | null> {
  const rows = await tx.query<{
    id: string;
    name: string;
    unit: string;
    unit_price_cents: unknown;
  }>(
    `select id, name, unit, unit_price_cents
       from articles
      where org_id = $1 and id = $2`,
    [orgId, articleId],
  );
  return rows[0] ? mapArticle(rows[0]) : null;
}

/**
 * Changes the article's current price only.
 * Quote lines and order lines keep the cents they stored earlier.
 */
export async function updateArticlePrice(
  tx: Tx,
  input: { orgId: string; articleId: string; unitPriceCents: number },
): Promise<Article> {
  const data = updateArticlePriceInput.parse({
    articleId: input.articleId,
    unitPriceCents: input.unitPriceCents,
  });
  const rows = await tx.query<{
    id: string;
    name: string;
    unit: string;
    unit_price_cents: unknown;
  }>(
    `update articles
        set unit_price_cents = $3
      where id = $1 and org_id = $2
      returning id, name, unit, unit_price_cents`,
    [data.articleId, input.orgId, data.unitPriceCents],
  );
  if (!rows[0]) throw new AppError("Artikel niet gevonden.");
  return mapArticle(rows[0]);
}
