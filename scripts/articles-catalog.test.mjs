import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const business = readFileSync(new URL("../migrations/0002_business.sql", import.meta.url), "utf8");
const catalog = readFileSync(new URL("../migrations/0003_articles_catalog.sql", import.meta.url), "utf8");

const orgId = "11111111-1111-4111-8111-111111111111";
const otherOrgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const owner = "user-owner";
const other = "user-other";

async function asRole(pg, userId, fn) {
  return pg.transaction(async (tx) => {
    await tx.query(`select set_config('app.user_id', $1, true)`, [userId]);
    const flags = await tx.query(
      `select coalesce((select usesuper from pg_user where usename = current_user), false) as super,
              exists (select 1 from pg_roles where rolname = 'app_user') as has_role`,
    );
    if (flags.rows[0].super && flags.rows[0].has_role) {
      await tx.query(`set local role app_user`);
    }
    return fn(tx);
  });
}

test("article catalog stores cost, minimum, and categories without touching quotes", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(business);
  await pg.exec(catalog);
  await pg.exec(catalog);

  const articleId = "33333333-3333-4333-8333-333333333333";
  const cableId = "c1111111-1111-4111-8111-111111111111";
  const toolsId = "c2222222-2222-4222-8222-222222222222";
  const quoteId = "44444444-4444-4444-8444-444444444444";
  const lineId = "66666666-6666-4666-8666-666666666666";
  const customerId = "22222222-2222-4222-8222-222222222222";

  await asRole(pg, owner, async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`, [orgId, owner]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, unit_price_cents) values ($1, $2, 'Plaat', 'stuk', 1000)`,
      [articleId, orgId],
    );
    const stored = await tx.query(
      `select cost_cents, min_qty::text as min_qty from articles where id = $1`,
      [articleId],
    );
    assert.equal(Number(stored.rows[0].cost_cents), 0);
    assert.equal(stored.rows[0].min_qty, "0");

    await tx.query(`update articles set cost_cents = 400, min_qty = 2.5 where id = $1`, [articleId]);
    await tx.query(`insert into article_categories (id, org_id, name) values ($1, $2, 'Kabel')`, [cableId, orgId]);
    await tx.query(`insert into article_categories (id, org_id, name) values ($1, $2, 'Gereedschap')`, [toolsId, orgId]);
    await tx.query(
      `insert into article_category_links (article_id, category_id, org_id) values ($1, $2, $3), ($1, $4, $3)`,
      [articleId, cableId, orgId, toolsId],
    );
    await tx.query(`insert into customers (id, org_id, name) values ($1, $2, 'Jansen')`, [customerId, orgId]);
    await tx.query(`insert into quotes (id, org_id, customer_id, status) values ($1, $2, $3, 'draft')`, [
      quoteId,
      orgId,
      customerId,
    ]);
    await tx.query(
      `insert into quote_lines (id, org_id, quote_id, article_id, description, qty, unit, unit_price_cents, position)
       values ($1, $2, $3, $4, 'Plaat', 2, 'stuk', 1000, 1)`,
      [lineId, orgId, quoteId, articleId],
    );
    await tx.query(`update articles set cost_cents = 9900, unit_price_cents = 15000 where id = $1`, [articleId]);
  });

  await assert.rejects(
    () =>
      asRole(pg, owner, (tx) =>
        tx.query(`insert into article_categories (id, org_id, name) values ($1, $2, ' kabel ')`, [
          "c3333333-3333-4333-8333-333333333333",
          orgId,
        ]),
      ),
  );

  await assert.rejects(
    () =>
      asRole(pg, owner, (tx) =>
        tx.query(`update articles set min_qty = -1 where id = $1`, [articleId]),
      ),
  );

  const line = await asRole(pg, owner, (tx) =>
    tx.query(`select unit_price_cents from quote_lines where id = $1`, [lineId]),
  );
  assert.equal(Number(line.rows[0].unit_price_cents), 1000);

  const names = await asRole(pg, owner, (tx) =>
    tx.query(
      `select c.name
         from article_category_links l
         join article_categories c on c.id = l.category_id
        where l.article_id = $1
        order by c.name`,
      [articleId],
    ),
  );
  assert.deepEqual(
    names.rows.map((row) => row.name),
    ["Gereedschap", "Kabel"],
  );

  await asRole(pg, owner, (tx) => tx.query(`delete from article_categories where id = $1`, [cableId]));
  const afterDelete = await asRole(pg, owner, async (tx) => {
    const article = await tx.query(`select id from articles where id = $1`, [articleId]);
    const links = await tx.query(`select category_id from article_category_links where article_id = $1`, [articleId]);
    return { article: article.rows.length, links: links.rows.map((row) => row.category_id) };
  });
  assert.equal(afterDelete.article, 1);
  assert.deepEqual(afterDelete.links, [toolsId]);

  await asRole(pg, other, async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Zuid')`, [otherOrgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`, [otherOrgId, other]);
  });

  const hidden = await asRole(pg, other, (tx) => tx.query(`select id from article_categories`));
  assert.equal(hidden.rows.length, 0);

  const otherCategory = "c4444444-4444-4444-8444-444444444444";
  await asRole(pg, other, (tx) =>
    tx.query(`insert into article_categories (id, org_id, name) values ($1, $2, 'Vreemd')`, [otherCategory, otherOrgId]),
  );
  await assert.rejects(
    () =>
      asRole(pg, owner, (tx) =>
        tx.query(
          `insert into article_category_links (article_id, category_id, org_id) values ($1, $2, $3)`,
          [articleId, otherCategory, orgId],
        ),
      ),
  );
});
