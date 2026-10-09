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

test("a person can be on two projects the same day, and only a project day is allowed", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of names) await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  await pg.exec(readFileSync(new URL("../migrations/0009_planning.sql", import.meta.url), "utf8"));

  const columns = await pg.query(
    `select column_name from information_schema.columns where table_name = 'assignments' and column_name = 'starts_on'`,
  );
  assert.equal(columns.rows.length, 0);

  const orgId = "11111111-1111-4111-8111-111111111111";
  const projectA = "b1111111-1111-4111-8111-111111111111";
  const projectB = "b2222222-2222-4222-8222-222222222222";
  const personId = "c1111111-1111-4111-8111-111111111111";
  const otherPerson = "c2222222-2222-4222-8222-222222222222";

  await asRole(pg, "owner", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'owner', 'owner')`, [orgId]);
    await tx.query(`insert into projects (id, org_id, name, required_crew) values ($1, $2, 'Dak', 2)`, [projectA, orgId]);
    await tx.query(`insert into projects (id, org_id, name, required_crew) values ($1, $2, 'Gevel', 1)`, [projectB, orgId]);
    await tx.query(
      `insert into project_days (id, org_id, project_id, work_date, required_crew) values
         ($1, $2, $3, current_date + 1, 2),
         ($4, $2, $5, current_date + 1, 1)`,
      ["d1111111-1111-4111-8111-111111111111", orgId, projectA, "d2222222-2222-4222-8222-222222222222", projectB],
    );
    await tx.query(`insert into crew_members (id, org_id, name) values ($1, $2, 'Sam')`, [personId, orgId]);
    await tx.query(
      `insert into assignments (id, org_id, crew_member_id, project_id, work_date, status)
       values ($1, $2, $3, $4, current_date + 1, 'confirmed')`,
      ["e1111111-1111-4111-8111-111111111111", orgId, personId, projectA],
    );
    await tx.query(
      `insert into assignments (id, org_id, crew_member_id, project_id, work_date, status)
       values ($1, $2, $3, $4, current_date + 1, 'asked')`,
      ["e2222222-2222-4222-8222-222222222222", orgId, personId, projectB],
    );
  });

  const count = await asRole(pg, "owner", (tx) =>
    tx.query(
      `select count(*) filter (where status = 'confirmed')::text as confirmed,
              count(*) filter (where status <> 'declined')::text as busy
         from assignments
        where crew_member_id = $1`,
      [personId],
    ),
  );
  assert.equal(count.rows[0].confirmed, "1");
  assert.equal(count.rows[0].busy, "2");

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(
        `insert into assignments (id, org_id, crew_member_id, project_id, work_date, status)
         values ($1, $2, $3, $4, current_date + 1, 'asked')`,
        ["e3333333-3333-4333-8333-333333333333", orgId, personId, projectA],
      ),
    ),
  );

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(
        `insert into assignments (id, org_id, crew_member_id, project_id, work_date, status)
         values ($1, $2, $3, $4, current_date + 9, 'asked')`,
        ["e4444444-4444-4444-8444-444444444444", orgId, personId, projectA],
      ),
    ),
  );

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(`update assignments set status = 'maybe' where crew_member_id = $1`, [personId]),
    ),
  );

  await asRole(pg, "owner", (tx) =>
    tx.query(`delete from project_days where project_id = $1`, [projectB]),
  );
  const left = await asRole(pg, "owner", (tx) =>
    tx.query(`select project_id from assignments where crew_member_id = $1`, [personId]),
  );
  assert.deepEqual(
    left.rows.map((row) => row.project_id),
    [projectA],
  );

  await asRole(pg, "other", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Zuid')`, ["aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"]);
    await tx.query(
      `insert into org_members (org_id, user_id, role) values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'other', 'owner')`,
    );
    await tx.query(
      `insert into crew_members (id, org_id, name) values ($1, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'Jo')`,
      [otherPerson],
    );
  });
  const hidden = await asRole(pg, "other", (tx) => tx.query(`select id from assignments`));
  assert.equal(hidden.rows.length, 0);
  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(
        `insert into assignments (id, org_id, crew_member_id, project_id, work_date, status)
         values ($1, $2, $3, $4, current_date + 1, 'asked')`,
        ["e5555555-5555-4555-8555-555555555555", orgId, otherPerson, projectA],
      ),
    ),
  );

  await pg.exec(readFileSync(new URL("../migrations/0009_planning.sql", import.meta.url), "utf8"));
  const still = await asRole(pg, "owner", (tx) => tx.query(`select id from assignments`));
  assert.equal(still.rows.length, 1);
});

test("planning asks projects for days and does not read project tables", () => {
  const source = readFileSync(new URL("../src/modules/planning/usecases.ts", import.meta.url), "utf8");
  assert.match(source, /listUpcomingDays/);
  assert.match(source, /listCrew/);
  assert.doesNotMatch(source, /project_days|project_demands|from projects/);
});
