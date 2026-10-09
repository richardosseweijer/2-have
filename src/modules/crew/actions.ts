import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { createCrewInput, updateCrewInput } from "./boundary";

export const listCrewAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listCrew } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listCrew(tx, org.id));
  });

export const createCrewAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createCrewInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de persoon.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createCrewMember } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => createCrewMember(tx, { orgId: org.id, ...data }));
  });

export const updateCrewAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = updateCrewInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de persoon.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { updateCrewMember } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => updateCrewMember(tx, { orgId: org.id, ...data }));
  });
