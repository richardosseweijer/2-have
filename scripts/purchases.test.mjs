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

test("a placed purchase is underway, a draft is not, and line cost stays put", async () => {
  const pg = new PGlite();
  await pg.waitReady;
  for (const name of names) await pg.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), "utf8"));
  await pg.exec(readFileSync(new URL("../migrations/0008_purchases.sql", import.meta.url), "utf8"));

  const orgId = "11111111-1111-4111-8111-111111111111";
  const otherOrgId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const articleId = "33333333-3333-4333-8333-333333333333";
  const otherArticleId = "33333333-3333-4333-8333-333333333334";
  const projectId = "b1111111-1111-4111-8111-111111111111";
  const supplierId = "d1111111-1111-4111-8111-111111111111";
  const purchaseId = "e1111111-1111-4111-8111-111111111111";
  const lineId = "f1111111-1111-4111-8111-111111111111";
  const customerId = "22222222-2222-4222-8222-222222222222";
  const quoteId = "44444444-4444-4444-8444-444444444444";
  const quoteLineId = "66666666-6666-4666-8666-666666666666";

  await asRole(pg, "owner", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Noord')`, [orgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'owner', 'owner')`, [orgId]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, cost_cents, unit_price_cents, min_qty)
       values ($1, $2, 'Plaat', 'stuk', 1000, 1350, 1)`,
      [articleId, orgId],
    );
    await tx.query(`insert into customers (id, org_id, name) values ($1, $2, 'Jansen')`, [customerId, orgId]);
    await tx.query(`insert into quotes (id, org_id, customer_id, status) values ($1, $2, $3, 'draft')`, [
      quoteId,
      orgId,
      customerId,
    ]);
    await tx.query(
      `insert into quote_lines (id, org_id, quote_id, article_id, description, qty, unit, cost_cents, unit_price_cents, position)
       values ($1, $2, $3, $4, 'Plaat', 2, 'stuk', 1000, 1350, 1)`,
      [quoteLineId, orgId, quoteId, articleId],
    );
    await tx.query(`insert into projects (id, org_id, name, status) values ($1, $2, 'Dak', 'planned')`, [projectId, orgId]);
    await tx.query(
      `insert into project_demands (id, org_id, project_id, article_id, description, unit, qty_needed, source)
       values ($1, $2, $3, $4, 'Plaat', 'stuk', 10, 'manual')`,
      ["c1111111-1111-4111-8111-111111111111", orgId, projectId, articleId],
    );
    await tx.query(`insert into suppliers (id, org_id, name) values ($1, $2, 'Houthandel')`, [supplierId, orgId]);
    await tx.query(
      `insert into purchase_orders (id, org_id, supplier_id, status) values ($1, $2, $3, 'draft')`,
      [purchaseId, orgId, supplierId],
    );
    await tx.query(
      `insert into purchase_lines
         (id, org_id, purchase_order_id, article_id, description, unit, qty_ordered, unit_cost_cents)
       values ($1, $2, $3, $4, 'Plaat', 'stuk', 6, 2500)`,
      [lineId, orgId, purchaseId, articleId],
    );
    await tx.query(`update articles set cost_cents = 5000 where id = $1`, [articleId]);
  });

  const frozen = await asRole(pg, "owner", (tx) =>
    tx.query(
      `select l.unit_cost_cents, a.cost_cents as article_cost, q.unit_price_cents as quote_price, q.cost_cents as quote_cost
         from purchase_lines l
         join articles a on a.id = l.article_id
         join quote_lines q on q.article_id = a.id
        where l.id = $1`,
      [lineId],
    ),
  );
  assert.equal(Number(frozen.rows[0].unit_cost_cents), 2500);
  assert.equal(Number(frozen.rows[0].article_cost), 5000);
  assert.equal(Number(frozen.rows[0].quote_price), 1350);
  assert.equal(Number(frozen.rows[0].quote_cost), 1000);

  const position = () =>
    asRole(pg, "owner", (tx) =>
      tx.query(
        `select
           coalesce((
             select sum(l.qty_ordered - l.qty_received)
               from purchase_lines l
               join purchase_orders o on o.id = l.purchase_order_id and o.org_id = l.org_id
              where l.article_id = a.id and o.status in ('ordered', 'partial')
           ), 0)::text as underway,
           greatest(0,
             coalesce((
               select sum(d.qty_needed - d.qty_issued)
                 from project_demands d
                 join projects p on p.id = d.project_id
                where d.article_id = a.id and p.status not in ('done', 'cancelled')
             ), 0)
             + a.min_qty
             - coalesce((select b.on_hand from stock_balances b where b.article_id = a.id), 0)
             - coalesce((
               select sum(l.qty_ordered - l.qty_received)
                 from purchase_lines l
                 join purchase_orders o on o.id = l.purchase_order_id
                where l.article_id = a.id and o.status in ('ordered', 'partial')
             ), 0)
           )::text as to_buy
         from articles a
        where a.id = $1`,
        [articleId],
      ),
    );

  let row = await position();
  assert.equal(row.rows[0].underway, "0");
  assert.equal(row.rows[0].to_buy, "11");

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(`update purchase_orders set status = 'ordered', number = 'INK-0001' where id = $1`, [purchaseId]),
    ),
  );

  await asRole(pg, "owner", (tx) =>
    tx.query(
      `update purchase_orders
          set status = 'ordered', number = 'INK-0001', expected_on = current_date
        where id = $1`,
      [purchaseId],
    ),
  );
  row = await position();
  assert.equal(row.rows[0].underway, "6");
  assert.equal(row.rows[0].to_buy, "5");

  const due = await asRole(pg, "owner", (tx) =>
    tx.query(
      `select case when expected_on < current_date then 'yes' else 'no' end as late
         from purchase_orders
        where status in ('ordered', 'partial')
          and expected_on <= current_date + 7
          and id = $1`,
      [purchaseId],
    ),
  );
  assert.equal(due.rows.length, 1);
  assert.equal(due.rows[0].late, "no");

  await asRole(pg, "owner", (tx) =>
    tx.query(`update purchase_orders set expected_on = current_date + 8 where id = $1`, [purchaseId]),
  );
  const later = await asRole(pg, "owner", (tx) =>
    tx.query(
      `select id from purchase_orders
        where id = $1 and status in ('ordered', 'partial') and expected_on <= current_date + 7`,
      [purchaseId],
    ),
  );
  assert.equal(later.rows.length, 0);

  await asRole(pg, "owner", async (tx) => {
    await tx.query(`update purchase_orders set status = 'partial', expected_on = current_date - 1 where id = $1`, [
      purchaseId,
    ]);
    await tx.query(`update purchase_lines set qty_received = 2 where id = $1`, [lineId]);
    await tx.query(`insert into stock_balances (article_id, org_id, on_hand) values ($1, $2, 2)`, [articleId, orgId]);
  });
  row = await position();
  assert.equal(row.rows[0].underway, "4");
  assert.equal(row.rows[0].to_buy, "5");

  const late = await asRole(pg, "owner", (tx) =>
    tx.query(
      `select case when expected_on < current_date then 'yes' else 'no' end as late
         from purchase_orders
        where id = $1 and status in ('ordered', 'partial') and expected_on <= current_date + 7`,
      [purchaseId],
    ),
  );
  assert.equal(late.rows[0].late, "yes");

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) => tx.query(`update purchase_lines set qty_received = 7 where id = $1`, [lineId])),
  );

  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(`insert into suppliers (id, org_id, name) values ($1, $2, ' houthandel ')`, [
        "d2222222-2222-4222-8222-222222222222",
        orgId,
      ]),
    ),
  );

  await asRole(pg, "other", async (tx) => {
    await tx.query(`insert into orgs (id, name) values ($1, 'Zuid')`, [otherOrgId]);
    await tx.query(`insert into org_members (org_id, user_id, role) values ($1, 'other', 'owner')`, [otherOrgId]);
    await tx.query(
      `insert into articles (id, org_id, name, unit, unit_price_cents) values ($1, $2, 'Ander', 'stuk', 100)`,
      [otherArticleId, otherOrgId],
    );
  });
  const hidden = await asRole(pg, "other", (tx) => tx.query(`select id from purchase_orders`));
  assert.equal(hidden.rows.length, 0);
  await assert.rejects(() =>
    asRole(pg, "owner", (tx) =>
      tx.query(
        `insert into purchase_lines
           (id, org_id, purchase_order_id, article_id, description, unit, qty_ordered, unit_cost_cents)
         values ($1, $2, $3, $4, 'Ander', 'stuk', 1, 100)`,
        ["f2222222-2222-4222-8222-222222222222", orgId, purchaseId, otherArticleId],
      ),
    ),
  );
});

test("inkoop receives stock and does not rewrite the article", () => {
  const purchases = readFileSync(new URL("../src/modules/purchases/usecases.ts", import.meta.url), "utf8");
  const receive = purchases.slice(purchases.indexOf("export async function receivePurchaseLine"));
  assert.match(receive, /receiveStock/);
  assert.doesNotMatch(purchases, /update articles/);
  assert.doesNotMatch(purchases, /project_demands|project_days/);
  const articles = readFileSync(new URL("../src/modules/articles/usecases.ts", import.meta.url), "utf8");
  assert.match(articles, /o\.status in \('ordered', 'partial'\)/);
});
