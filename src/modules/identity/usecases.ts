import { AppError } from "@/lib/app-error";
import { withTransaction, type Tx } from "@/lib/db";
import { createOrgInput, type OrgContext } from "./boundary";

async function armRls(tx: Tx, userId: string): Promise<void> {
  await tx.query(`select set_config('app.user_id', $1, true)`, [userId]);
  const rows = await tx.query<{ super: boolean; has_role: boolean }>(
    `select
       coalesce((select usesuper from pg_user where usename = current_user), false) as super,
       exists (select 1 from pg_roles where rolname = 'app_user') as has_role`,
  );
  if (rows[0]?.super && rows[0]?.has_role) {
    await tx.query(`set local role app_user`);
  }
}

export async function currentOrg(tx: Tx, userId: string): Promise<OrgContext | null> {
  const rows = await tx.query<{ id: string; name: string; role: "owner" | "member" }>(
    `select o.id, o.name, m.role
       from org_members m
       join orgs o on o.id = m.org_id
      where m.user_id = $1`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function createOrg(
  tx: Tx,
  input: { userId: string; name: string },
): Promise<OrgContext> {
  const { name } = createOrgInput.parse({ name: input.name });
  const existing = await currentOrg(tx, input.userId);
  if (existing) throw new AppError("Je hoort al bij een organisatie.");
  const id = crypto.randomUUID();
  await tx.query(`insert into orgs (id, name) values ($1, $2)`, [id, name]);
  await tx.query(
    `insert into org_members (org_id, user_id, role) values ($1, $2, 'owner')`,
    [id, input.userId],
  );
  return { id, name, role: "owner" };
}

/** Opens one transaction, sets the caller, then runs `fn`. */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withTransaction(async (tx) => {
    await armRls(tx, userId);
    return fn(tx);
  });
}

/** Like withUser, but requires a membership and passes that org in. */
export async function withOrg<T>(
  userId: string,
  fn: (tx: Tx, org: OrgContext) => Promise<T>,
): Promise<T> {
  return withUser(userId, async (tx) => {
    const org = await currentOrg(tx, userId);
    if (!org) throw new AppError("Maak eerst een organisatie aan.");
    return fn(tx, org);
  });
}
