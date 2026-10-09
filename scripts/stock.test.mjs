import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const names = [
  "0002_business.sql",
  "0003_articles_catalog.sql",
  "0004_quote_markup.sql",
  "0005_crew.sql",
  "0006_projects.sql",
  "0007_stock.sql",
];

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

test("stock falls only on a movement, and needed comes from open projects", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of names) await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  await pg.exec(readFileSync(new URL("../migrations/0007_stock.sql", import.meta.url), "utf8"));

  const orgId = "11111111-1111-4111-8111-111111111111";
  const articleId = "33333333-3333-4333-8333-333333333333";
  const projectId = "b1111111-1111-4111-8111-111111111111";

  await asRole(pg, "owner", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'owner', 'owner')`, [orgId]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, cost_cents, unit_price_cents, min_qty) values ($1, $2, 'Plaat', 'stuk', 1000, 1350, 2)`,
      [articleId, orgId],
    );
    await tx.query(`insert into projects (id, org_id, name, status) values ($1, $2, 'Dak', 'planned')`, [projectId, orgId]);
    await tx.query(
      `insert into project_demands (id, org_id, project_id, article_id, description, unit, qty_needed, qty_issued, source)
       values ($1, $2, $3, $4, 'Plaat', 'stuk', 5, 1, 'manual')`,
      ["e1111111-1111-4111-8111-111111111111", orgId, projectId, articleId],
    );
    await tx.query(`insert into stock_balances (article_id, org_id, on_hand) values ($1, $2, 10)`, [articleId, orgId]);
    await tx.query(
      `insert into stock_movements (id, org_id, article_id, qty, kind) values ($1, $2, $3, 10, 'receipt')`,
      ["f1111111-1111-4111-8111-111111111111", orgId, articleId],
    );
    await tx.query(`update stock_balances set on_hand = on_hand - 4 where article_id = $1`, [articleId]);
    await tx.query(
      `insert into stock_movements (id, org_id, article_id, qty, kind, project_id) values ($1, $2, $3, -4, 'issue', $4)`,
      ["f2222222-2222-4222-8222-222222222222", orgId, articleId, projectId],
    );
  });

  const row = await asRole(pg, "owner", (tx) =>
    tx.query(
      `select b.on_hand::text as on_hand,
              (select sum(d.qty_needed - d.qty_issued)::text
                 from project_demands d
                 join projects p on p.id = d.project_id
                where d.article_id = a.id and p.status not in ('done', 'cancelled')) as needed,
              greatest(0,
                coalesce((select sum(d.qty_needed - d.qty_issued) from project_demands d join projects p on p.id = d.project_id where d.article_id = a.id and p.status not in ('done', 'cancelled')), 0)
                + a.min_qty - b.on_hand
              )::text as to_buy
         from articles a
         join stock_balances b on b.article_id = a.id
        where a.id = $1`,
      [articleId],
    ),
  );
  assert.equal(row.rows[0].on_hand, "6");
  assert.equal(row.rows[0].needed, "4");
  assert.equal(Number(row.rows[0].to_buy), 0);

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(`insert into stock_movements (id, org_id, article_id, qty, kind) values ($1, $2, $3, 0, 'adjust')`, [
        "f3333333-3333-4333-8333-333333333333",
        orgId,
        articleId,
      ]),
    ),
  );
});
