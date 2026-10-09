import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { createCustomerInput } from "./boundary";

export const listCustomersAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listCustomers } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listCustomers(tx, org.id));
  });

export const createCustomerAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createCustomerInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de klantgegevens.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createCustomer } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => createCustomer(tx, { orgId: org.id, ...data }));
  });
