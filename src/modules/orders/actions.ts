import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";

export const listOrdersAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listOrders } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listOrders(tx, org.id));
  });

export const getOrderAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.uuid() }).safeParse(input);
    if (!parsed.success) throw new Error("Bestelling niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { getOrder } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => getOrder(tx, org.id, data.id));
  });
