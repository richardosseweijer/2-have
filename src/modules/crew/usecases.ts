import { AppError } from "@/lib/app-error";
import type { Tx } from "@/lib/db";
import { createCrewInput, updateCrewInput, type CrewMember } from "./boundary";

function mapMember(row: {
  id: string;
  name: string;
  phone: string;
  email: string;
  kind: CrewMember["kind"];
  company: string;
  notes: string;
  active: boolean;
}): CrewMember {
  return row;
}

function assertEmail(email: string) {
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError("Vul een geldig e-mailadres in.");
  }
}

const columns = `id, name, phone, email, kind, company, notes, active`;

export async function listCrew(tx: Tx, orgId: string): Promise<CrewMember[]> {
  return tx.query<CrewMember>(
    `select ${columns}
       from crew_members
      where org_id = $1
      order by active desc, name asc`,
    [orgId],
  );
}

export async function createCrewMember(
  tx: Tx,
  input: {
    orgId: string;
    name: string;
    phone?: string;
    email?: string;
    kind: CrewMember["kind"];
    company?: string;
    notes?: string;
  },
): Promise<CrewMember> {
  const data = createCrewInput.parse(input);
  assertEmail(data.email);
  const id = crypto.randomUUID();
  const rows = await tx.query<CrewMember>(
    `insert into crew_members (id, org_id, name, phone, email, kind, company, notes)
     values ($1, $2, $3, $4, $5, $6, $7, $8)
     returning ${columns}`,
    [id, input.orgId, data.name, data.phone, data.email, data.kind, data.company, data.notes],
  );
  return mapMember(rows[0]);
}

export async function updateCrewMember(
  tx: Tx,
  input: {
    orgId: string;
    crewMemberId: string;
    name: string;
    phone: string;
    email: string;
    kind: CrewMember["kind"];
    company: string;
    notes: string;
    active: boolean;
  },
): Promise<CrewMember> {
  const data = updateCrewInput.parse(input);
  assertEmail(data.email);
  const rows = await tx.query<CrewMember>(
    `update crew_members
        set name = $3, phone = $4, email = $5, kind = $6, company = $7, notes = $8, active = $9
      where id = $1 and org_id = $2
      returning ${columns}`,
    [
      data.crewMemberId,
      input.orgId,
      data.name,
      data.phone,
      data.email,
      data.kind,
      data.company,
      data.notes,
      data.active,
    ],
  );
  if (!rows[0]) throw new AppError("Persoon niet gevonden.");
  return mapMember(rows[0]);
}
