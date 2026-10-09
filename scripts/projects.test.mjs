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

test("an empty project can hold dates and material without touching stock", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of names) {
    await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  await pg.exec(readFileSync(new URL("../migrations/0006_projects.sql", import.meta.url), "utf8"));

  const orgId = "11111111-1111-4111-8111-111111111111";
  const projectId = "b1111111-1111-4111-8111-111111111111";
  const articleId = "33333333-3333-4333-8333-333333333333";
  const dayId = "d1111111-1111-4111-8111-111111111111";

  await asRole(pg, "owner", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'owner', 'owner')`, [orgId]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, unit_price_cents) values ($1, $2, 'Plaat', 'stuk', 1000)`,
      [articleId, orgId],
    );
    await tx.query(
      `insert into projects (id, org_id, name) values ($1, $2, 'Dak')`,
      [projectId, orgId],
    );
    await tx.query(
      `insert into project_days (id, org_id, project_id, work_date, required_crew) values ($1, $2, $3, '2026-11-02', 4)`,
      [dayId, orgId, projectId],
    );
    await tx.query(
      `insert into project_demands
         (id, org_id, project_id, article_id, description, unit, qty_needed, source)
       values ($1, $2, $3, $4, 'Plaat', 'stuk', 3, 'manual')`,
      ["e1111111-1111-4111-8111-111111111111", orgId, projectId, articleId],
    );
  });

  const project = await asRole(pg, "owner", (tx) =>
    tx.query(`select status, required_crew, quote_id from projects where id = $1`, [projectId]),
  );
  assert.equal(project.rows[0].status, "planned");
  assert.equal(Number(project.rows[0].required_crew), 0);
  assert.equal(project.rows[0].quote_id, null);

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(
        `insert into project_days (id, org_id, project_id, work_date, required_crew) values ($1, $2, $3, '2026-11-02', 4)`,
        ["d2222222-2222-4222-8222-222222222222", orgId, projectId],
      ),
    ),
  );

  const tables = await pg.query(
    `select table_name from information_schema.tables where table_name in ('stock_balances', 'stock_movements')`,
  );
  assert.equal(tables.rows.length, 0);

  await asRole(pg, "other", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Zuid')`, ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
    await tx.query(
      `insert into org_members (org_id, user_id, role) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'other', 'owner')`,
    );
  });
  const hidden = await asRole(pg, "other", (tx) => tx.query(`select id from project_days`));
  assert.equal(hidden.rows.length, 0);
});
