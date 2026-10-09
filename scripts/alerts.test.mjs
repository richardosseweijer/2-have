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
  "0008_purchases.sql",
  "0009_planning.sql",
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

test("two days on one project do not double the material still needed", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of names) await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));

  const orgId = "11111111-1111-4111-8111-111111111111";
  const projectId = "b1111111-1111-4111-8111-111111111111";
  const articleId = "33333333-3333-4333-8333-333333333333";
  const personId = "c1111111-1111-4111-8111-111111111111";

  await asRole(pg, "owner", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'owner', 'owner')`, [orgId]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, unit_price_cents) values ($1, $2, 'Plaat', 'stuk', 1000)`,
      [articleId, orgId],
    );
    await tx.query(`insert into projects (id, org_id, name, required_crew) values ($1, $2, 'Dak', 2)`, [projectId, orgId]);
    await tx.query(
      `insert into project_days (id, org_id, project_id, work_date, required_crew) values
         ($1, $2, $3, current_date + 1, 2),
         ($4, $2, $3, current_date + 2, 2)`,
      ["d1111111-1111-4111-8111-111111111111", orgId, projectId, "d2222222-2222-4222-8222-222222222222"],
    );
    await tx.query(
      `insert into project_demands
         (id, org_id, project_id, article_id, description, unit, qty_needed, qty_issued, source)
       values ($1, $2, $3, $4, 'Plaat', 'stuk', 5, 1, 'manual')`,
      ["e1111111-1111-4111-8111-111111111111", orgId, projectId, articleId],
    );
    await tx.query(`insert into crew_members (id, org_id, name) values ($1, $2, 'Sam')`, [personId, orgId]);
    await tx.query(
      `insert into assignments (id, org_id, crew_member_id, project_id, work_date, status)
       values ($1, $2, $3, $4, current_date + 1, 'asked')`,
      ["f1111111-1111-4111-8111-111111111111", orgId, personId, projectId],
    );
  });

  const need = await asRole(pg, "owner", (tx) =>
    tx.query(
      `with soon as (
         select p.id as project_id, min(d.work_date) as earliest
           from projects p
           join project_days d on d.project_id = p.id
          where p.org_id = $1
            and p.status not in ('done', 'cancelled')
            and d.work_date >= current_date
            and d.work_date <= current_date + 7
          group by p.id
       )
       select sum(dem.qty_needed - dem.qty_issued)::text as qty_remaining
         from project_demands dem
         join soon on soon.project_id = dem.project_id
        where dem.qty_needed > dem.qty_issued
        group by dem.article_id, soon.project_id`,
      [orgId],
    ),
  );
  assert.equal(need.rows[0].qty_remaining, "4");

  const gap = await asRole(pg, "owner", (tx) =>
    tx.query(
      `select count(*) filter (where status = 'confirmed')::text as confirmed
         from assignments
        where project_id = $1 and work_date = current_date + 1`,
      [projectId],
    ),
  );
  assert.equal(gap.rows[0].confirmed, "0");
});
