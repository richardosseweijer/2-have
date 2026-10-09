import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  addPurchaseLineInput,
  createPurchaseInput,
  createSupplierInput,
  purchaseIdInput,
  receiveLineInput,
  removePurchaseLineInput,
  setExpectedInput,
  updateSupplierInput,
} from "./boundary";

export const listIncomingAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listIncoming } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listIncoming(tx, org.id));
  });

export const listPurchasingAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listPurchasing } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listPurchasing(tx, org.id));
  });

export const getPurchaseAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.uuid() }).safeParse(input);
    if (!parsed.success) throw new Error("Inkooporder niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { getPurchase } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => getPurchase(tx, org.id, data.id));
  });

export const createSupplierAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createSupplierInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de leverancier.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createSupplier } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => createSupplier(tx, { orgId: org.id, ...data }));
  });

export const updateSupplierAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = updateSupplierInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de leverancier.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { updateSupplier } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => updateSupplier(tx, { orgId: org.id, ...data }));
  });

export const createPurchaseAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createPurchaseInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de inkooporder.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createPurchase } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => createPurchase(tx, { orgId: org.id, ...data }));
  });

export const addPurchaseLineAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = addPurchaseLineInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de regel.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { addPurchaseLine } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => addPurchaseLine(tx, { orgId: org.id, ...data }));
  });

export const removePurchaseLineAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = removePurchaseLineInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de regel.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { removePurchaseLine } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => removePurchaseLine(tx, { orgId: org.id, ...data }));
  });

export const setPurchaseExpectedAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = setExpectedInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de leverdatum.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { setPurchaseExpected } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => setPurchaseExpected(tx, { orgId: org.id, ...data }));
  });

export const placePurchaseAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = purchaseIdInput.safeParse(input);
    if (!parsed.success) throw new Error("Inkooporder niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { placePurchase } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => placePurchase(tx, { orgId: org.id, ...data }));
  });

export const receivePurchaseLineAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = receiveLineInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer het aantal.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { receivePurchaseLine } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => receivePurchaseLine(tx, { orgId: org.id, ...data }));
  });

export const cancelPurchaseAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = purchaseIdInput.safeParse(input);
    if (!parsed.success) throw new Error("Inkooporder niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { cancelPurchase } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => cancelPurchase(tx, { orgId: org.id, ...data }));
  });
