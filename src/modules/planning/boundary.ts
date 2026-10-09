import { z } from "zod";

export const assignmentStatuses = ["asked", "confirmed", "declined"] as const;
export type AssignmentStatus = (typeof assignmentStatuses)[number];

export const assignmentStatusLabel: Record<AssignmentStatus, string> = {
  asked: "Gevraagd",
  confirmed: "Bevestigd",
  declined: "Afgezegd",
};

const workDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const assignInput = z.object({
  projectId: z.uuid(),
  workDate,
  crewMemberId: z.uuid(),
  status: z.enum(assignmentStatuses).default("asked"),
});

export const setAssignmentStatusInput = z.object({
  assignmentId: z.uuid(),
  status: z.enum(assignmentStatuses),
});

export const removeAssignmentInput = z.object({
  assignmentId: z.uuid(),
});

export type PlanningPerson = {
  id: string;
  name: string;
  active: boolean;
};

export type PlannedAssignment = {
  id: string;
  crewMemberId: string;
  crewName: string;
  active: boolean;
  status: AssignmentStatus;
  conflictProjectNames: string[];
};

export type PlannedDay = {
  dayId: string;
  projectId: string;
  projectName: string;
  workDate: string;
  requiredCrew: number;
  confirmed: number;
  coverage: "short" | "exact" | "over";
  assignments: PlannedAssignment[];
};

export type StaffingGap = {
  projectId: string;
  projectName: string;
  workDate: string;
  requiredCrew: number;
  confirmed: number;
};

export type PlanningBoard = {
  days: PlannedDay[];
  crew: PlanningPerson[];
};
