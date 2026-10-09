import { z } from "zod";
import { parseQty } from "@/lib/money";

export const projectStatuses = ["planned", "in_progress", "done", "cancelled"] as const;
export type ProjectStatus = (typeof projectStatuses)[number];

export const projectStatusLabel: Record<ProjectStatus, string> = {
  planned: "Gepland",
  in_progress: "Bezig",
  done: "Klaar",
  cancelled: "Geannuleerd",
};

const requiredCrew = z.number().int().min(0).max(500);
const workDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const qtyText = z
  .string()
  .trim()
  .min(1)
  .max(32)
  .refine((value) => {
    const parsed = parseQty(value);
    return parsed != null && parsed !== "0";
  }, "Aantal moet groter zijn dan nul.");

export const createProjectInput = z.object({
  name: z.string().trim().min(1).max(160),
  customerId: z.uuid().nullable(),
});

export const projectIdInput = z.object({
  projectId: z.uuid(),
});

export const addDayInput = projectIdInput.extend({
  workDate,
});

export const removeDayInput = projectIdInput.extend({
  dayId: z.uuid(),
});

export const setRequiredCrewInput = projectIdInput.extend({
  requiredCrew,
  applyToDays: z.boolean(),
});

export const addDemandInput = projectIdInput.extend({
  articleId: z.uuid(),
  qty: qtyText,
});

export const issueDemandInput = projectIdInput.extend({
  demandId: z.uuid(),
  qty: qtyText,
});

export const setProjectStatusInput = projectIdInput.extend({
  status: z.enum(projectStatuses),
});

export type ProjectDay = {
  id: string;
  workDate: string;
  requiredCrew: number;
};

export type ProjectDemand = {
  id: string;
  articleId: string;
  description: string;
  unit: string;
  qtyNeeded: string;
  qtyIssued: string;
  source: "quote_line" | "manual";
};

export type ProjectSummary = {
  id: string;
  name: string;
  status: ProjectStatus;
  customerName: string | null;
  nextDate: string | null;
};

export type ProjectDetail = ProjectSummary & {
  customerId: string | null;
  quoteId: string | null;
  orderId: string | null;
  requiredCrew: number;
  days: ProjectDay[];
  demands: ProjectDemand[];
};

export type UpcomingDay = {
  id: string;
  projectId: string;
  projectName: string;
  workDate: string;
  requiredCrew: number;
  projectStatus: ProjectStatus;
};

export type UpcomingNeed = {
  articleId: string;
  projectId: string;
  projectName: string;
  description: string;
  unit: string;
  qtyRemaining: string;
  earliestDate: string;
};
