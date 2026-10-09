import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const sql = readFileSync(new URL("../migrations/0002_business.sql", import.meta.url), "utf8");

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

test("accept_quote snapshots price, numbers, and org isolation", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  await pg.exec(sql);

  const orgId = "11111111-1111-4111-8111-111111111111";
  const customerId = "22222222-2222-4222-8222-222222222222";
  const articleId = "33333333-3333-4333-8333-333333333333";
  const quoteId = "44444444-4444-4444-8444-444444444444";
  const dealId = "55555555-5555-4555-8555-555555555555";
  const owner = "user-owner";

  await asRole(pg, owner, async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(
      `insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`,
      [orgId, owner],
    );
    await tx.query(`insert into customers (id, org_id, name) values ($1, $2, 'Jansen')`, [
      customerId,
      orgId,
    ]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, unit_price_cents) values ($1, $2, 'Plaat', 'stuk', 1000)`,
      [articleId, orgId],
    );
    await tx.query(
      `insert into quotes (id, org_id, customer_id, status) values ($1, $2, $3, 'sent')`,
      [quoteId, orgId, customerId],
    );
    await tx.query(
      `insert into quote_lines (id, org_id, quote_id, article_id, description, qty, unit, unit_price_cents, position)
       values ($1, $2, $3, $4, 'Plaat', 2, 'stuk', 1000, 1)`,
      ["66666666-6666-4666-8666-666666666666", orgId, quoteId, articleId],
    );
    await tx.query(
      `insert into quote_lines (id, org_id, quote_id, description, qty, unit, unit_price_cents, position)
       values ($1, $2, $3, 'Uren', 1.5, 'uur', 2500, 2)`,
      ["77777777-7777-4777-8777-777777777777", orgId, quoteId],
    );
    await tx.query(
      `insert into deals (id, org_id, quote_id, customer_id, status) values ($1, $2, $3, $4, 'open')`,
      [dealId, orgId, quoteId, customerId],
    );
    await tx.query(`update articles set unit_price_cents = 9900 where id = $1`, [articleId]);
  });

  const lines = await asRole(pg, owner, (tx) =>
    tx.query(`select unit_price_cents from quote_lines where quote_id = $1 order by position`, [quoteId]),
  );
  assert.deepEqual(
    lines.rows.map((row) => Number(row.unit_price_cents)),
    [1000, 2500],
  );

  const accepted = await asRole(pg, owner, (tx) => tx.query(`select accept_quote($1) as order_id`, [quoteId]));
  const orderId = accepted.rows[0].order_id;

  const state = await asRole(pg, owner, async (tx) => {
    const quote = await tx.query(`select number, status from quotes where id = $1`, [quoteId]);
    const deal = await tx.query(`select status from deals where quote_id = $1`, [quoteId]);
    const order = await tx.query(`select number, status from orders where id = $1`, [orderId]);
    const copied = await tx.query(
      `select description, qty::text as qty, unit, unit_price_cents
         from order_lines where order_id = $1 order by position`,
      [orderId],
    );
    const article = await tx.query(`select unit_price_cents from articles where id = $1`, [articleId]);
    return { quote: quote.rows[0], deal: deal.rows[0], order: order.rows[0], copied: copied.rows, article: article.rows[0] };
  });

  assert.equal(state.quote.number, "OFF-0001");
  assert.equal(state.quote.status, "accepted");
  assert.equal(state.deal.status, "won");
  assert.equal(state.order.number, "ORD-0001");
  assert.equal(state.order.status, "confirmed");
  assert.equal(Number(state.article.unit_price_cents), 9900);
  assert.equal(state.copied.length, 2);
  assert.equal(state.copied[0].description, "Plaat");
  assert.equal(Number(state.copied[0].unit_price_cents), 1000);
  assert.equal(state.copied[1].unit, "uur");
  assert.equal(Number(state.copied[1].unit_price_cents), 2500);

  const outsider = await asRole(pg, "someone-else", (tx) =>
    tx.query(`select id from quotes`),
  );
  assert.equal(outsider.rows.length, 0);

  await assert.rejects(
    asRole(pg, owner, (tx) => tx.query(`select accept_quote($1)`, [quoteId])),
    /quote cannot be accepted/,
  );
});
