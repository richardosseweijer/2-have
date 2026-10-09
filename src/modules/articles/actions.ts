import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { authMiddleware } from "@/lib/auth/middleware";
import {
  createArticleInput,
  createCategoryInput,
  deleteCategoryInput,
  renameCategoryInput,
  updateArticleInput,
  updateArticlePriceInput,
} from "./boundary";

export const listArticlesAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listArticles } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listArticles(tx, org.id));
  });

export const listArticleCatalogAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listArticles, listCategories } = await import("./usecases");
    return withOrg(context.userId, async (tx, org) => ({
      articles: await listArticles(tx, org.id),
      categories: await listCategories(tx, org.id),
    }));
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

export const updateArticleAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = updateArticleInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer het artikel.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { updateArticle } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => updateArticle(tx, { orgId: org.id, ...data }));
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

export const createCategoryAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createCategoryInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de categorie.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createCategory } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => createCategory(tx, { orgId: org.id, ...data }));
  });

export const renameCategoryAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = renameCategoryInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de categorie.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { renameCategory } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => renameCategory(tx, { orgId: org.id, ...data }));
  });

export const deleteCategoryAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = deleteCategoryInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de categorie.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { deleteCategory } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => deleteCategory(tx, { orgId: org.id, ...data }));
  });

const countedInput = z.object({
  articleId: z.uuid(),
  counted: z.string().trim().min(1).max(32),
});

export const adjustStockAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = countedInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de telling.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { adjustStock } = await import("./usecases");
    return withOrg(context.userId, (tx, org) =>
      adjustStock(tx, { orgId: org.id, articleId: data.articleId, counted: data.counted }),
    );
  });
