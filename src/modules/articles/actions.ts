import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import { createArticleInput, updateArticlePriceInput } from "./boundary";

export const listArticlesAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listArticles } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listArticles(tx, org.id));
  });

export const getArticleAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = z.object({ id: z.uuid() }).safeParse(input);
    if (!parsed.success) throw new Error("Artikel niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { getArticle } = await import("./usecases");
    return withOrg(context.userId, async (tx, org) => {
      const article = await getArticle(tx, org.id, data.id);
      if (!article) throw new Error("Artikel niet gevonden.");
      return article;
    });
  });

export const createArticleAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createArticleInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer het artikel.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createArticle } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => createArticle(tx, { orgId: org.id, ...data }));
  });

export const updateArticlePriceAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = updateArticlePriceInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de prijs.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { updateArticlePrice } = await import("./usecases");
    return withOrg(context.userId, (tx, org) =>
      updateArticlePrice(tx, { orgId: org.id, ...data }),
    );
  });
