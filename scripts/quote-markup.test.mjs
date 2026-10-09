import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const files = ["0002_business.sql", "0003_articles_catalog.sql", "0004_quote_markup.sql"];

async function asRole(pg, userId, fn) {
  return pg.transaction(async (tx) => {
    await tx.query(`select set_config('app.user_id', $1, true)`, [userId]);
    const flags = await tx.query(
      `select coalesce((select usesuper from pg_user where usename = current_user), false) as super,
              exists (select 1 from pg_roles where rolname = 'app_user') as has_role`,
    );
    if (flags.rows[0].super && flags.rows[0].has_role) await tx.query(`set local role app_user`);
    return fn(tx);
  });
}

test("quote markup is snapshotted and an article cost change does not rewrite the line", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of files) {
    const sql = readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8");
    await pg.exec(sql);
  }
  await pg.exec(readFileSync(new URL("../migrations/0004_quote_markup.sql", import.meta.url), "utf8"));

  const orgId = "11111111-1111-4111-8111-111111111111";
  const owner = "user-owner";
  const articleId = "33333333-3333-4333-8333-333333333333";
  const quoteId = "44444444-4444-4444-8444-444444444444";
  const lineId = "66666666-6666-4666-8666-666666666666";
  const customerId = "22222222-2222-4222-8222-222222222222";

  await asRole(pg, owner, async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`, [orgId, owner]);
    await tx.query(`update orgs set default_markup_bps = 3500 where id = $1`, [orgId]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, cost_cents, unit_price_cents) values ($1, $2, 'Plaat', 'stuk', 1000, 1350)`,
      [articleId, orgId],
    );
    await tx.query(`insert into customers (id, org_id, name) values ($1, $2, 'Jansen')`, [customerId, orgId]);
    await tx.query(
      `insert into quotes (id, org_id, customer_id, status, markup_bps) values ($1, $2, $3, 'draft', 3500)`,
      [quoteId, orgId, customerId],
    );
    await tx.query(
      `insert into quote_lines
         (id, org_id, quote_id, article_id, description, qty, unit, cost_cents, markup_bps, unit_price_cents, position)
       values ($1, $2, $3, $4, 'Plaat', 2, 'stuk', 1000, null, 1350, 1)`,
      [lineId, orgId, quoteId, articleId],
    );
    await tx.query(`update articles set cost_cents = 9900, unit_price_cents = 20000 where id = $1`, [articleId]);
  });

  const line = await asRole(pg, owner, (tx) =>
    tx.query(`select cost_cents, unit_price_cents, markup_bps from quote_lines where id = $1`, [lineId]),
  );
  assert.equal(Number(line.rows[0].cost_cents), 1000);
  assert.equal(Number(line.rows[0].unit_price_cents), 1350);
  assert.equal(line.rows[0].markup_bps, null);

  const org = await asRole(pg, owner, (tx) =>
    tx.query(`select default_markup_bps from orgs where id = $1`, [orgId]),
  );
  assert.equal(Number(org.rows[0].default_markup_bps), 3500);

  await assert.rejects(() =>
    asRole(pg, owner, (tx) => tx.query(`update quotes set markup_bps = -1 where id = $1`, [quoteId])),
  );
  await assert.rejects(() =>
    asRole(pg, owner, (tx) => tx.query(`update quote_lines set markup_bps = -10001 where id = $1`, [lineId])),
  );
});
