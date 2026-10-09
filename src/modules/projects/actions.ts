import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  addDayInput,
  addDemandInput,
  createProjectInput,
  issueDemandInput,
  removeDayInput,
  setProjectStatusInput,
  setRequiredCrewInput,
} from "./boundary";

export const listUpcomingNeedsAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listUpcomingNeeds } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listUpcomingNeeds(tx, org.id));
  });

export const listProjectsAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listProjects } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listProjects(tx, org.id));
  });

export const getProjectAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.uuid() }).safeParse(input);
    if (!parsed.success) throw new Error("Project niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { getProject } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => getProject(tx, org.id, data.id));
  });

export const createProjectAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createProjectInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer het project.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createEmptyProject } = await import("./usecases");
    return withOrg(context.userId, (tx, org) =>
      createEmptyProject(tx, { orgId: org.id, name: data.name, customerId: data.customerId }),
    );
  });

export const addProjectDayAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = addDayInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de datum.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { addProjectDay } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => addProjectDay(tx, { orgId: org.id, ...data }));
  });

export const removeProjectDayAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = removeDayInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de datum.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { removeProjectDay } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => removeProjectDay(tx, { orgId: org.id, ...data }));
  });

export const setRequiredCrewAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = setRequiredCrewInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer het aantal.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { setRequiredCrew } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => setRequiredCrew(tx, { orgId: org.id, ...data }));
  });

export const addDemandAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = addDemandInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer het materiaal.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { addDemand } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => addDemand(tx, { orgId: org.id, ...data }));
  });

export const issueMaterialAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = issueDemandInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer het aantal.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { issueMaterial } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => issueMaterial(tx, { orgId: org.id, ...data }));
  });

export const setProjectStatusAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = setProjectStatusInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de status.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { setProjectStatus } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => setProjectStatus(tx, { orgId: org.id, ...data }));
  });
