import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { createQuoteInput, quoteIdInput } from "./boundary";

export const listQuotesAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const { withOrg } = await import("../identity");
    const { listQuotes } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => listQuotes(tx, org.id));
  });

export const getQuoteAction = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = quoteIdInput.safeParse(input);
    if (!parsed.success) throw new Error("Offerte niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { getQuote } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => getQuote(tx, org.id, data.id));
  });

export const createQuoteAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = createQuoteInput.safeParse(input);
    if (!parsed.success) throw new Error("Controleer de offerte.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { createQuote } = await import("./usecases");
    return withOrg(context.userId, (tx, org) => createQuote(tx, { orgId: org.id, ...data }));
  });

export const markQuoteSentAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = quoteIdInput.safeParse(input);
    if (!parsed.success) throw new Error("Offerte niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { markQuoteSent } = await import("./usecases");
    return withOrg(context.userId, (tx, org) =>
      markQuoteSent(tx, { orgId: org.id, quoteId: data.id }),
    );
  });

export const rejectQuoteAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = quoteIdInput.safeParse(input);
    if (!parsed.success) throw new Error("Offerte niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { rejectQuote } = await import("./usecases");
    return withOrg(context.userId, (tx, org) =>
      rejectQuote(tx, { orgId: org.id, quoteId: data.id }),
    );
  });

export const acceptQuoteAction = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => {
    const parsed = quoteIdInput.safeParse(input);
    if (!parsed.success) throw new Error("Offerte niet gevonden.");
    return parsed.data;
  })
  .handler(async ({ context, data }) => {
    const { withOrg } = await import("../identity");
    const { acceptQuote } = await import("./usecases");
    return withOrg(context.userId, (tx, org) =>
      acceptQuote(tx, { orgId: org.id, quoteId: data.id }),
    );
  });
