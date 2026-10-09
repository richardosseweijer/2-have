import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { assignInput, removeAssignmentInput, setAssignmentStatusInput } from "./boundary";

export const listStaffingGapsAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listStaffingGaps } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listStaffingGaps(tx, org.id));
  });

export const listPlanningAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listPlanning } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listPlanning(tx, org.id));
  });

export const assignToDayAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = assignInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de inzet.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { assignToDay } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => assignToDay(tx, { orgId: org.id, ...data }));
  });

export const setAssignmentStatusAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = setAssignmentStatusInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de status.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { setAssignmentStatus } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => setAssignmentStatus(tx, { orgId: org.id, ...data }));
  });

export const removeAssignmentAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = removeAssignmentInput.safeParse(input);
    if (!parsed.success) throw new Error("Inzet niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { removeAssignment } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => removeAssignment(tx, { orgId: org.id, ...data }));
  });
