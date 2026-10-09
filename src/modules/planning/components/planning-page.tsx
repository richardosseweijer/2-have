import { useState } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Panel, Select, StatusPill } from "@/components/ui";
import { errorText } from "@/lib/errors";
import {
  assignmentStatusLabel,
  assignmentStatuses,
  type AssignmentStatus,
  type PlannedDay,
  type PlanningBoard,
  type PlanningPerson,
} from "../boundary";
import { assignToDayAction, removeAssignmentAction, setAssignmentStatusAction } from "../actions";

const coverageLabel = { short: "Tekort", exact: "Vol", over: "Teveel" } as const;
const coverageTone = { short: "bad", exact: "ok", over: "warn" } as const;

export function PlanningPage({ board }: { board: PlanningBoard }) {
  const dates = [...new Set(board.days.map((day) => day.workDate))];
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Planning</h1>
        <p className="mt-1 text-muted">
          Per persoon, per project, per dag. Alleen bevestigd telt mee. Een conflict mag, en blijft zichtbaar.
        </p>
      </header>
      {dates.length === 0 ? (
        <Panel>
          <p className="text-muted">Nog geen uitvoerdagen vanaf vandaag.</p>
        </Panel>
      ) : (
        dates.map((date) => (
          <section key={date} className="grid gap-3">
            <h2 className="font-display text-2xl tabular-nums">{date}</h2>
            {board.days
              .filter((day) => day.workDate === date)
              .map((day) => (
                <DayCard key={day.dayId} day={day} crew={board.crew.filter((person) => person.active)} />
              ))}
          </section>
        ))
      )}
    </div>
  );
}

function DayCard({ day, crew }: { day: PlannedDay; crew: PlanningPerson[] }) {
  return (
    <Panel className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">{day.projectName}</h3>
          <p className="text-sm text-muted">
            {day.confirmed} van {day.requiredCrew} bevestigd
          </p>
        </div>
        <StatusPill tone={coverageTone[day.coverage]}>{coverageLabel[day.coverage]}</StatusPill>
      </div>
      {day.assignments.length === 0 ? <p className="text-sm text-muted">Nog niemand.</p> : null}
      <ul>
        {day.assignments.map((assignment) => (
          <AssignmentRow key={assignment.id} assignment={assignment} />
        ))}
      </ul>
      <AddPerson projectId={day.projectId} workDate={day.workDate} crew={crew} />
    </Panel>
  );
}

function AssignmentRow({
  assignment,
}: {
  assignment: PlannedDay["assignments"][number];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function setStatus(status: AssignmentStatus) {
    setPending(true);
    setError(null);
    try {
      await setAssignmentStatusAction({ data: { assignmentId: assignment.id, status } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    setPending(true);
    setError(null);
    try {
      await removeAssignmentAction({ data: { assignmentId: assignment.id } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-2 border-t border-line py-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto] sm:items-center">
      <div>
        <p className="font-medium">
          {assignment.crewName}
          {assignment.active ? "" : " · inactief"}
        </p>
        {assignment.conflictProjectNames.length > 0 ? (
          <p className="text-sm text-bad">Ook op {assignment.conflictProjectNames.join(", ")}</p>
        ) : null}
      </div>
      <Select
        value={assignment.status}
        disabled={pending}
        aria-label={`Status van ${assignment.crewName}`}
        onChange={(event) => void setStatus(event.target.value as AssignmentStatus)}
      >
        {assignmentStatuses.map((status) => (
          <option key={status} value={status}>
            {assignmentStatusLabel[status]}
          </option>
        ))}
      </Select>
      <Button variant="danger" disabled={pending} onClick={() => void remove()}>
        Weg
      </Button>
      {error ? <div className="sm:col-span-3"><ErrorNote>{error}</ErrorNote></div> : null}
    </li>
  );
}

function AddPerson({
  projectId,
  workDate,
  crew,
}: {
  projectId: string;
  workDate: string;
  crew: PlanningPerson[];
}) {
  const router = useRouter();
  const [crewMemberId, setCrewMemberId] = useState(crew[0]?.id ?? "");
  const chosen = crew.some((person) => person.id === crewMemberId) ? crewMemberId : (crew[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add() {
    if (!chosen) {
      setError("Er is nog geen actief persoon.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await assignToDayAction({ data: { projectId, workDate, crewMemberId: chosen, status: "asked" } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  if (crew.length === 0) return <p className="text-sm text-muted">Voeg eerst iemand toe bij Crew.</p>;

  return (
    <div className="grid gap-3 border-t border-line pt-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <Field label="Persoon">
        <Select value={chosen} onChange={(event) => setCrewMemberId(event.target.value)}>
          {crew.map((person) => (
            <option key={person.id} value={person.id}>
              {person.name}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="ghost" disabled={pending} onClick={() => void add()}>
        {pending ? "Opslaan…" : "Vragen"}
      </Button>
      {error ? <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
    </div>
  );
}
