import { z } from "zod";

export const createOrgInput = z.object({
  name: z.string().trim().min(1).max(120),
});

export const markupBpsInput = z.number().int().min(0).max(100_000);

export const setDefaultMarkupInput = z.object({
  markupBps: markupBpsInput,
});

export type CreateOrgInput = z.infer<typeof createOrgInput>;

export type OrgContext = {
  id: string;
  name: string;
  role: "owner" | "member";
  defaultMarkupBps: number;
};
