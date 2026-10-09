import { z } from "zod";

export const crewKinds = ["employee", "freelancer"] as const;
export type CrewKind = (typeof crewKinds)[number];

export const crewKindLabel: Record<CrewKind, string> = {
  employee: "Vast",
  freelancer: "Freelancer",
};

const person = {
  name: z.string().trim().min(1).max(160),
  phone: z.string().trim().max(40).default(""),
  email: z.string().trim().max(160).default(""),
  kind: z.enum(crewKinds),
  company: z.string().trim().max(160).default(""),
  notes: z.string().trim().max(500).default(""),
};

export const createCrewInput = z.object(person);

export const updateCrewInput = z.object({
  ...person,
  crewMemberId: z.uuid(),
  active: z.boolean(),
});

export type CrewMember = {
  id: string;
  name: string;
  phone: string;
  email: string;
  kind: CrewKind;
  company: string;
  notes: string;
  active: boolean;
};
