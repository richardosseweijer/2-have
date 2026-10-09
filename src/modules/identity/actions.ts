import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { createOrgInput } from "./boundary";

export const getCurrentOrgAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { currentOrg, withUser } = await import("./usecases");
    return withUser(context.userId, (tx) => currentOrg(tx, context.userId));
  });

export const createOrgAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createOrgInput.safeParse(input);
    if (!parsed.success) throw new Error("Vul een organisatienaam in.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { createOrg, withUser } = await import("./usecases");
    return withUser(context.userId, (tx) =>
      createOrg(tx, { userId: context.userId, name: data.name }),
    );
  });
