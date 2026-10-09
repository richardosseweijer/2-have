import { z } from "zod";

export const createOrgInput = z.object({
  name: z.string().trim().min(1).max(120),
});

export type CreateOrgInput = z.infer<typeof createOrgInput>;

export type OrgContext = {
  id: string;
  name: string;
  role: "owner" | "member";
};
