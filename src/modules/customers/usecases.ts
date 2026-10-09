import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { createCustomerInput, type Customer } from "./boundary";

function blankToNull(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function mapCustomer(row: {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  city: string | null;
}): Customer {
  return row;
}

export async function createCustomer(
  tx: Tx,
  input: { orgId: string; name: string; email?: string; phone?: string; city?: string },
): Promise<Customer> {
  const data = createCustomerInput.parse(input);
  const email = blankToNull(data.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("Vul een geldig e-mailadres in.");
  }
  const id = crypto.randomUUID();
  await tx.query(
    `insert into customers (id, org_id, name, email, phone, city)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, input.orgId, data.name, email, blankToNull(data.phone), blankToNull(data.city)],
  );
  return {
    id,
    name: data.name,
    email,
    phone: blankToNull(data.phone),
    city: blankToNull(data.city),
  };
}

export async function listCustomers(tx: Tx, orgId: string): Promise<Customer[]> {
  const rows = await tx.query<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
  }>(
    `select id, name, email, phone, city
       from customers
      where org_id = $1
      order by name asc`,
    [orgId],
  );
  return rows.map(mapCustomer);
}

export async function getCustomer(
  tx: Tx,
  orgId: string,
  customerId: string,
): Promise<Customer | null> {
  const rows = await tx.query<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
  }>(
    `select id, name, email, phone, city
       from customers
      where org_id = $1 and id = $2`,
    [orgId, customerId],
  );
  return rows[0] ? mapCustomer(rows[0]) : null;
}
