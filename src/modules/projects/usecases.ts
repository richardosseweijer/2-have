import { getArticle, issueStock } from "../articles";
import { getCustomer } from "../customers";
import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { asNumber, parseQty } from "@/lib/money";
import {
  addDayInput,
  addDemandInput,
  createProjectInput,
  issueDemandInput,
  removeDayInput,
  setProjectStatusInput,
  setRequiredCrewInput,
  type ProjectDemand,
  type ProjectDetail,
  type ProjectSummary,
  type UpcomingDay,
  type UpcomingNeed,
} from "./boundary";

function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = "code" in error ? String(error.code) : "";
  return code === "23505";
}

function assertRealDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new AppError("Die datum bestaat niet.");
  }
}

async function requireProjectId(tx: Tx, orgId: string, projectId: string) {
  const rows = await tx.query<{ id: string; required_crew: unknown }>(
    `select id, required_crew from projects where id = $1 and org_id = $2`,
    [projectId, orgId],
  );
  if (!rows[0]) throw new AppError("Project niet gevonden.");
  return { id: rows[0].id, requiredCrew: asNumber(rows[0].required_crew) };
}

export async function listProjects(tx: Tx, orgId: string): Promise<ProjectSummary[]> {
  const rows = await tx.query<{
    id: string;
    name: string;
    status: ProjectSummary["status"];
    customer_name: string | null;
    next_date: string | null;
  }>(
    `select p.id, p.name, p.status, c.name as customer_name,
            (
              select to_char(min(d.work_date), 'YYYY-MM-DD')
                from project_days d
               where d.project_id = p.id and d.work_date >= current_date
            ) as next_date
       from projects p
       left join customers c on c.id = p.customer_id and c.org_id = p.org_id
      where p.org_id = $1
      order by p.created_at desc`,
    [orgId],
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    customerName: row.customer_name,
    nextDate: row.next_date,
  }));
}

export async function getProject(tx: Tx, orgId: string, projectId: string): Promise<ProjectDetail | null> {
  const rows = await tx.query<{
    id: string;
    name: string;
    status: ProjectSummary["status"];
    customer_id: string | null;
    customer_name: string | null;
    quote_id: string | null;
    order_id: string | null;
    required_crew: unknown;
    next_date: string | null;
  }>(
    `select p.id, p.name, p.status, p.customer_id, c.name as customer_name,
            p.quote_id, p.order_id, p.required_crew,
            (
              select to_char(min(d.work_date), 'YYYY-MM-DD')
                from project_days d
               where d.project_id = p.id and d.work_date >= current_date
            ) as next_date
       from projects p
       left join customers c on c.id = p.customer_id and c.org_id = p.org_id
      where p.org_id = $1 and p.id = $2`,
    [orgId, projectId],
  );
  const project = rows[0];
  if (!project) return null;
  const days = await tx.query<{ id: string; work_date: string; required_crew: unknown }>(
    `select id, to_char(work_date, 'YYYY-MM-DD') as work_date, required_crew
       from project_days
      where project_id = $1 and org_id = $2
      order by work_date asc`,
    [projectId, orgId],
  );
  const demands = await tx.query<{
    id: string;
    article_id: string;
    description: string;
    unit: string;
    qty_needed: string;
    qty_issued: string;
    source: ProjectDemand["source"];
  }>(
    `select id, article_id, description, unit,
            qty_needed::text as qty_needed, qty_issued::text as qty_issued, source
       from project_demands
      where project_id = $1 and org_id = $2
      order by description asc`,
    [projectId, orgId],
  );
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    customerId: project.customer_id,
    customerName: project.customer_name,
    quoteId: project.quote_id,
    orderId: project.order_id,
    requiredCrew: asNumber(project.required_crew),
    nextDate: project.next_date,
    days: days.map((day) => ({
      id: day.id,
      workDate: day.work_date,
      requiredCrew: asNumber(day.required_crew),
    })),
    demands: demands.map((demand) => ({
      id: demand.id,
      articleId: demand.article_id,
      description: demand.description,
      unit: demand.unit,
      qtyNeeded: demand.qty_needed,
      qtyIssued: demand.qty_issued,
      source: demand.source,
    })),
  };
}

export async function createEmptyProject(
  tx: Tx,
  input: { orgId: string; name: string; customerId: string | null },
): Promise<{ id: string }> {
  const data = createProjectInput.parse(input);
  if (data.customerId) {
    const customer = await getCustomer(tx, input.orgId, data.customerId);
    if (!customer) throw new AppError("Klant niet gevonden.");
  }
  const id = crypto.randomUUID();
  await tx.query(
    `insert into projects (id, org_id, name, customer_id, status, required_crew)
     values ($1, $2, $3, $4, 'planned', 0)`,
    [id, input.orgId, data.name, data.customerId],
  );
  return { id };
}

export async function addProjectDay(
  tx: Tx,
  input: { orgId: string; projectId: string; workDate: string },
): Promise<void> {
  const data = addDayInput.parse(input);
  assertRealDate(data.workDate);
  const project = await requireProjectId(tx, input.orgId, data.projectId);
  try {
    await tx.query(
      `insert into project_days (id, org_id, project_id, work_date, required_crew)
       values ($1, $2, $3, $4, $5)`,
      [crypto.randomUUID(), input.orgId, data.projectId, data.workDate, project.requiredCrew],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("Die dag staat al op het project.");
    throw error;
  }
}

export async function removeProjectDay(
  tx: Tx,
  input: { orgId: string; projectId: string; dayId: string },
): Promise<void> {
  const data = removeDayInput.parse(input);
  const rows = await tx.query<{ id: string }>(
    `delete from project_days where id = $1 and project_id = $2 and org_id = $3 returning id`,
    [data.dayId, data.projectId, input.orgId],
  );
  if (!rows[0]) throw new AppError("Die dag staat niet op het project.");
}

export async function setRequiredCrew(
  tx: Tx,
  input: { orgId: string; projectId: string; requiredCrew: number; applyToDays: boolean },
): Promise<void> {
  const data = setRequiredCrewInput.parse(input);
  await requireProjectId(tx, input.orgId, data.projectId);
  const rows = await tx.query<{ id: string }>(
    `update projects set required_crew = $3 where id = $1 and org_id = $2 returning id`,
    [data.projectId, input.orgId, data.requiredCrew],
  );
  if (!rows[0]) throw new AppError("Project niet gevonden.");
  if (data.applyToDays) {
    await tx.query(
      `update project_days set required_crew = $3 where project_id = $1 and org_id = $2`,
      [data.projectId, input.orgId, data.requiredCrew],
    );
  }
}

export async function addDemand(
  tx: Tx,
  input: { orgId: string; projectId: string; articleId: string; qty: string },
): Promise<void> {
  const data = addDemandInput.parse(input);
  const qty = parseQty(data.qty);
  if (qty == null || qty === "0") throw new AppError("Aantal moet groter zijn dan nul.");
  await requireProjectId(tx, input.orgId, data.projectId);
  const article = await getArticle(tx, input.orgId, data.articleId);
  if (!article) throw new AppError("Artikel niet gevonden.");
  await tx.query(
    `insert into project_demands
       (id, org_id, project_id, article_id, description, unit, qty_needed, source)
     values ($1, $2, $3, $4, $5, $6, $7, 'manual')`,
    [crypto.randomUUID(), input.orgId, data.projectId, article.id, article.name, article.unit, qty],
  );
}

export async function createFromAcceptedQuote(
  tx: Tx,
  input: {
    orgId: string;
    quoteId: string;
    orderId: string;
    customerId: string;
    quoteNumber: string;
    customerName: string;
    lines: { id: string; articleId: string | null; description: string; qty: string; unit: string }[];
  },
): Promise<{ id: string }> {
  const name = `${input.quoteNumber} — ${input.customerName}`.slice(0, 160);
  const id = crypto.randomUUID();
  try {
    await tx.query(
      `insert into projects (id, org_id, name, customer_id, quote_id, order_id, status, required_crew)
       values ($1, $2, $3, $4, $5, $6, 'planned', 0)`,
      [id, input.orgId, name, input.customerId, input.quoteId, input.orderId],
    );
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("Voor deze offerte bestaat al een project.");
    throw error;
  }
  for (const line of input.lines) {
    if (!line.articleId) continue;
    await tx.query(
      `insert into project_demands
         (id, org_id, project_id, article_id, description, unit, qty_needed, source, quote_line_id)
       values ($1, $2, $3, $4, $5, $6, $7, 'quote_line', $8)`,
      [
        crypto.randomUUID(),
        input.orgId,
        id,
        line.articleId,
        line.description,
        line.unit,
        line.qty,
        line.id,
      ],
    );
  }
  return { id };
}

export async function setProjectStatus(
  tx: Tx,
  input: { orgId: string; projectId: string; status: ProjectSummary["status"] },
): Promise<void> {
  const data = setProjectStatusInput.parse(input);
  const rows = await tx.query<{ id: string }>(
    `update projects set status = $3 where id = $1 and org_id = $2 returning id`,
    [data.projectId, input.orgId, data.status],
  );
  if (!rows[0]) throw new AppError("Project niet gevonden.");
}

export async function issueMaterial(
  tx: Tx,
  input: { orgId: string; projectId: string; demandId: string; qty: string },
): Promise<void> {
  const data = issueDemandInput.parse(input);
  const qty = parseQty(data.qty);
  if (qty == null || qty === "0") throw new AppError("Aantal moet groter zijn dan nul.");
  const demands = await tx.query<{ article_id: string; qty_needed: string; qty_issued: string }>(
    `select article_id, qty_needed::text as qty_needed, qty_issued::text as qty_issued
       from project_demands
      where id = $1 and project_id = $2 and org_id = $3
      for update`,
    [data.demandId, data.projectId, input.orgId],
  );
  const demand = demands[0];
  if (!demand) throw new AppError("Materiaalregel niet gevonden.");
  await issueStock(tx, {
    orgId: input.orgId,
    articleId: demand.article_id,
    qty,
    projectId: data.projectId,
  });
  await tx.query(
    `update project_demands
        set qty_issued = qty_issued + least($4::numeric, qty_needed - qty_issued)
      where id = $1 and project_id = $2 and org_id = $3`,
    [data.demandId, data.projectId, input.orgId, qty],
  );
}

export async function listUpcomingDays(
  tx: Tx,
  orgId: string,
  withinDays: number | null = null,
): Promise<UpcomingDay[]> {
  const rows = await tx.query<{
    id: string;
    project_id: string;
    project_name: string;
    work_date: string;
    required_crew: unknown;
    status: ProjectSummary["status"];
  }>(
    `select d.id, d.project_id, p.name as project_name,
            to_char(d.work_date, 'YYYY-MM-DD') as work_date,
            d.required_crew, p.status
       from project_days d
       join projects p on p.id = d.project_id and p.org_id = d.org_id
      where d.org_id = $1
        and d.work_date >= current_date
        and p.status not in ('done', 'cancelled')
        and ($2::int is null or d.work_date <= current_date + $2::int)
      order by d.work_date asc, p.name asc`,
    [orgId, withinDays],
  );
  return rows.map((row) => ({
    id: row.id,
    projectId: row.project_id,
    projectName: row.project_name,
    workDate: row.work_date,
    requiredCrew: asNumber(row.required_crew),
    projectStatus: row.status,
  }));
}

const ALERT_HORIZON_DAYS = 7;

export async function listUpcomingNeeds(tx: Tx, orgId: string): Promise<UpcomingNeed[]> {
  const rows = await tx.query<{
    article_id: string;
    project_id: string;
    project_name: string;
    description: string;
    unit: string;
    qty_remaining: string;
    earliest: string;
  }>(
    `with soon as (
       select p.id as project_id, p.name, min(d.work_date) as earliest
         from projects p
         join project_days d on d.project_id = p.id and d.org_id = p.org_id
        where p.org_id = $1
          and p.status not in ('done', 'cancelled')
          and d.work_date >= current_date
          and d.work_date <= current_date + $2::int
        group by p.id, p.name
     )
     select dem.article_id, soon.project_id, soon.name as project_name,
            min(dem.description) as description, min(dem.unit) as unit,
            sum(dem.qty_needed - dem.qty_issued)::text as qty_remaining,
            to_char(min(soon.earliest), 'YYYY-MM-DD') as earliest
       from project_demands dem
       join soon on soon.project_id = dem.project_id
      where dem.qty_needed > dem.qty_issued
      group by dem.article_id, soon.project_id, soon.name
      order by min(soon.earliest), soon.name`,
    [orgId, ALERT_HORIZON_DAYS],
  );
  return rows.map((row) => ({
    articleId: row.article_id,
    projectId: row.project_id,
    projectName: row.project_name,
    description: row.description,
    unit: row.unit,
    qtyRemaining: row.qty_remaining,
    earliestDate: row.earliest,
  }));
}
