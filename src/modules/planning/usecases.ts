import { listCrew } from "../crew";
import { listUpcomingDays } from "../projects";
import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import {
  assignInput,
  removeAssignmentInput,
  setAssignmentStatusInput,
  type AssignmentStatus,
  type PlannedAssignment,
  type PlannedDay,
  type PlanningBoard,
  type StaffingGap,
} from "./boundary";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  if (code === "23505") return true;
  const message = "message" in error ? String(error.message) : "";
  return /duplicate key|unique constraint/i.test(message);
}

function assertRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new AppError("Die datum bestaat niet.");
  }
}

type Row = {
  id: string;
  project_id: string;
  work_date: string;
  crew_member_id: string;
  status: AssignmentStatus;
};

export async function listPlanning(tx: Tx, orgId: string): Promise<PlanningBoard> {
  const days = await listUpcomingDays(tx, orgId, null);
  const people = await listCrew(tx, orgId);
  const rows = await tx.query<Row>(
      `select id, project_id, to_char(work_date, 'YYYY-MM-DD') as work_date, crew_member_id, status
         from assignments
        where org_id = $1 and work_date >= current_date`,
      [orgId],
    );
  const personById = new Map(people.map((person) => [person.id, person]));
  const names = new Map(days.map((day) => [day.projectId, day.projectName]));
  const conflicts = new Map<string, Map<string, string>>();
  for (const row of rows) {
    if (row.status === "declined") continue;
    const key = `${row.crew_member_id}|${row.work_date}`;
    const projects = conflicts.get(key) ?? new Map<string, string>();
    projects.set(row.project_id, names.get(row.project_id) ?? "Ander project");
    conflicts.set(key, projects);
  }

  const planned: PlannedDay[] = days.map((day) => {
    const onDay = rows.filter((row) => row.project_id === day.projectId && row.work_date === day.workDate);
    const assignments: PlannedAssignment[] = onDay.map((row) => {
      const person = personById.get(row.crew_member_id);
      const key = `${row.crew_member_id}|${row.work_date}`;
      const others = conflicts.get(key);
      const conflictProjectNames =
        row.status === "declined" || !others
          ? []
          : [...others.entries()].filter(([projectId]) => projectId !== day.projectId).map(([, name]) => name);
      return {
        id: row.id,
        crewMemberId: row.crew_member_id,
        crewName: person?.name ?? "Onbekend",
        active: person?.active ?? false,
        status: row.status,
        conflictProjectNames,
      };
    });
    const confirmed = assignments.filter((row) => row.status === "confirmed").length;
    const coverage = confirmed < day.requiredCrew ? "short" : confirmed > day.requiredCrew ? "over" : "exact";
    return {
      dayId: day.id,
      projectId: day.projectId,
      projectName: day.projectName,
      workDate: day.workDate,
      requiredCrew: day.requiredCrew,
      confirmed,
      coverage,
      assignments,
    };
  });

  return {
    days: planned,
    crew: people.map((person) => ({ id: person.id, name: person.name, active: person.active })),
  };
}

export async function assignToDay(
  tx: Tx,
  input: { orgId: string; projectId: string; workDate: string; crewMemberId: string; status?: AssignmentStatus },
): Promise<void> {
  const data = assignInput.parse(input);
  assertRealDate(data.workDate);
  const days = await listUpcomingDays(tx, input.orgId, null);
  const day = days.find((item) => item.projectId === data.projectId && item.workDate === data.workDate);
  if (!day) throw new AppError("Die dag staat niet op een open project.");
  const people = await listCrew(tx, input.orgId);
  const person = people.find((item) => item.id === data.crewMemberId);
  if (!person || !person.active) throw new AppError("Kies een actief persoon.");
  try {
    await tx.query(
      `insert into assignments (id, org_id, crew_member_id, project_id, work_date, status)
       values ($1, $2, $3, $4, $5, $6)`,
      [crypto.randomUUID(), input.orgId, data.crewMemberId, data.projectId, data.workDate, data.status],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("Deze persoon staat al op die dag.");
    throw error;
  }
}

export async function setAssignmentStatus(
  tx: Tx,
  input: { orgId: string; assignmentId: string; status: AssignmentStatus },
): Promise<void> {
  const data = setAssignmentStatusInput.parse(input);
  const rows = await tx.query<{ id: string }>(
    `update assignments set status = $3 where id = $1 and org_id = $2 returning id`,
    [data.assignmentId, input.orgId, data.status],
  );
  if (!rows[0]) throw new AppError("Inzet niet gevonden.");
}

export async function removeAssignment(
  tx: Tx,
  input: { orgId: string; assignmentId: string },
): Promise<void> {
  const data = removeAssignmentInput.parse(input);
  const rows = await tx.query<{ id: string }>(
    `delete from assignments where id = $1 and org_id = $2 returning id`,
    [data.assignmentId, input.orgId],
  );
  if (!rows[0]) throw new AppError("Inzet niet gevonden.");
}

const ALERT_HORIZON_DAYS = 7;

export async function listStaffingGaps(tx: Tx, orgId: string): Promise<StaffingGap[]> {
  const days = await listUpcomingDays(tx, orgId, ALERT_HORIZON_DAYS);
  const counts = await tx.query<{ project_id: string; work_date: string; confirmed: string }>(
    `select project_id, to_char(work_date, 'YYYY-MM-DD') as work_date,
            count(*) filter (where status = 'confirmed')::text as confirmed
       from assignments
      where org_id = $1
        and work_date >= current_date
        and work_date <= current_date + $2::int
      group by project_id, work_date`,
    [orgId, ALERT_HORIZON_DAYS],
  );
  const confirmed = new Map(counts.map((row) => [`${row.project_id}|${row.work_date}`, Number(row.confirmed)]));
  return days
    .map((day) => ({
      projectId: day.projectId,
      projectName: day.projectName,
      workDate: day.workDate,
      requiredCrew: day.requiredCrew,
      confirmed: confirmed.get(`${day.projectId}|${day.workDate}`) ?? 0,
    }))
    .filter((day) => day.confirmed < day.requiredCrew);
}
