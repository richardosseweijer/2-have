import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const names = ["0002_business.sql", "0003_articles_catalog.sql", "0004_quote_markup.sql", "0005_crew.sql"];

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

test("crew contact fields stay on the existing people table", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of names) {
    await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  }
  await pg.exec(readFileSync(new URL("../migrations/0005_crew.sql", import.meta.url), "utf8"));

  const orgId = "11111111-1111-4111-8111-111111111111";
  const otherOrg = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const personId = "c5555555-5555-4555-8555-555555555555";

  await asRole(pg, "owner", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'owner', 'owner')`, [orgId]);
    await tx.query(`insert into crew_members (id, org_id, name) values ($1, $2, 'Sam')`, [personId, orgId]);
  });

  const row = await asRole(pg, "owner", (tx) =>
    tx.query(`select phone, email, kind, company, active from crew_members where id = $1`, [personId]),
  );
  assert.equal(row.rows[0].phone, "");
  assert.equal(row.rows[0].kind, "employee");
  assert.equal(row.rows[0].active, true);

  await asRole(pg, "owner", (tx) =>
    tx.query(
      `update crew_members set phone = '061234', email = 'sam@bureau.nl', kind = 'freelancer', company = 'Bureau', active = false where id = $1`,
      [personId],
    ),
  );
  const updated = await asRole(pg, "owner", (tx) =>
    tx.query(`select name, kind, active from crew_members where id = $1`, [personId]),
  );
  assert.equal(updated.rows[0].name, "Sam");
  assert.equal(updated.rows[0].kind, "freelancer");
  assert.equal(updated.rows[0].active, false);

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) => tx.query(`update crew_members set kind = 'stagiair' where id = $1`, [personId])),
  );

  await asRole(pg, "other", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Zuid')`, [otherOrg]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'other', 'owner')`, [otherOrg]);
  });
  const hidden = await asRole(pg, "other", (tx) => tx.query(`select id from crew_members`));
  assert.equal(hidden.rows.length, 0);
});
