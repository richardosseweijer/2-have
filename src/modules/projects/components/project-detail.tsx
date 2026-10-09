import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import type { Article } from "@/modules/articles";
import { Button, ErrorNote, Field, Input, Panel, Select, StatusPill } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { formatQty, parseQty } from "@/lib/money";
import { projectStatusLabel, projectStatuses, type ProjectDetail } from "../boundary";
import {
  addDemandAction,
  addProjectDayAction,
  issueMaterialAction,
  removeProjectDayAction,
  setProjectStatusAction,
  setRequiredCrewAction,
} from "../actions";

const tone = {
  planned: "neutral",
  in_progress: "warn",
  done: "ok",
  cancelled: "bad",
} as const;

export function ProjectDetailPage({ project, articles }: { project: ProjectDetail; articles: Article[] }) {
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/projecten" className="text-sm text-muted">
            Terug naar projecten
          </Link>
          <h1 className="font-display text-4xl tracking-tight">{project.name}</h1>
          <p className="mt-1 text-muted">{project.customerName ?? "Geen klant"}</p>
          <p className="mt-2 flex flex-wrap gap-3 text-sm font-semibold">
            {project.quoteId ? (
              <Link to="/offertes/$id" params={{ id: project.quoteId }} className="text-navy">
                Offerte
              </Link>
            ) : null}
            {project.orderId ? (
              <Link to="/bestellingen/$id" params={{ id: project.orderId }} className="text-navy">
                Bestelling
              </Link>
            ) : null}
          </p>
        </div>
        <StatusPill tone={tone[project.status]}>{projectStatusLabel[project.status]}</StatusPill>
      </header>
      <StatusForm project={project} />
      <CrewForm project={project} />
      <Days project={project} />
      <Demands project={project} articles={articles} />
    </div>
  );
}

function StatusForm({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [status, setStatus] = useState(project.status);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    try {
      await setProjectStatusAction({ data: { projectId: project.id, status } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="grid gap-3 sm:grid-cols-[16rem_auto] sm:items-end">
      <Field label="Status">
        <Select value={status} onChange={(event) => setStatus(event.target.value as ProjectDetail["status"])}>
          {projectStatuses.map((option) => (
            <option key={option} value={option}>
              {projectStatusLabel[option]}
            </option>
          ))}
        </Select>
      </Field>
      <Button variant="ghost" disabled={pending} onClick={() => void save()}>
        {pending ? "Opslaan…" : "Status opslaan"}
      </Button>
      {error ? <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
    </Panel>
  );
}

function CrewForm({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [count, setCount] = useState(String(project.requiredCrew));
  const [apply, setApply] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    const requiredCrew = Number(count);
    if (!Number.isInteger(requiredCrew) || requiredCrew < 0) {
      setError("Vul een heel aantal mensen in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await setRequiredCrewAction({ data: { projectId: project.id, requiredCrew, applyToDays: apply } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="grid gap-3">
      <h2 className="font-display text-2xl">Bemanning nodig</h2>
      <div className="grid gap-3 sm:grid-cols-[10rem_auto] sm:items-end">
        <Field label="Aantal" hint="Nieuwe dagen nemen dit getal over.">
          <Input inputMode="numeric" value={count} onChange={(event) => setCount(event.target.value)} />
        </Field>
        <Button variant="ghost" disabled={pending} onClick={() => void save()}>
          {pending ? "Opslaan…" : "Aantal opslaan"}
        </Button>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" className="size-4 accent-navy" checked={apply} onChange={(event) => setApply(event.target.checked)} />
        Ook op de dagen die er al staan
      </label>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </Panel>
  );
}

function Days({ project }: { project: ProjectDetail }) {
  const router = useRouter();
  const [workDate, setWorkDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add() {
    if (!workDate) {
      setError("Kies een datum.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addProjectDayAction({ data: { projectId: project.id, workDate } });
      setWorkDate("");
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function remove(dayId: string) {
    setError(null);
    try {
      await removeProjectDayAction({ data: { projectId: project.id, dayId } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <Panel className="grid gap-3">
      <h2 className="font-display text-2xl">Uitvoerdagen</h2>
      {project.days.length === 0 ? <p className="text-sm text-muted">Nog geen dagen.</p> : null}
      <ul>
        {project.days.map((day) => (
          <li key={day.id} className="flex items-center justify-between gap-3 border-t border-line py-2">
            <span className="tabular-nums">
              {day.workDate} · {day.requiredCrew} mensen
            </span>
            <Button variant="danger" onClick={() => void remove(day.id)}>
              Weg
            </Button>
          </li>
        ))}
      </ul>
      <div className="grid gap-3 sm:grid-cols-[16rem_auto] sm:items-end">
        <Field label="Dag toevoegen">
          <Input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
        </Field>
        <Button variant="ghost" disabled={pending} onClick={() => void add()}>
          {pending ? "Opslaan…" : "Dag toevoegen"}
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </Panel>
  );
}

function Demands({ project, articles }: { project: ProjectDetail; articles: Article[] }) {
  const router = useRouter();
  const [articleId, setArticleId] = useState(articles[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function add() {
    const parsed = parseQty(qty);
    if (!articleId || parsed == null || parsed === "0") {
      setError("Kies een artikel en een aantal groter dan nul.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addDemandAction({ data: { projectId: project.id, articleId, qty: parsed } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="grid gap-3">
      <h2 className="font-display text-2xl">Materiaal</h2>
      <p className="text-sm text-muted">Uitgeven haalt het van de plank. Meer dan er ligt kan niet.</p>
      {project.demands.length === 0 ? <p className="text-sm text-muted">Nog geen materiaal.</p> : null}
      <ul>
        {project.demands.map((demand) => (
          <li key={demand.id} className="border-t border-line py-2 text-sm">
            <span className="font-medium">{demand.description}</span>
            <span className="text-muted">
              {" "}
              · nodig {formatQty(demand.qtyNeeded)} {demand.unit}
              · uitgegeven {formatQty(demand.qtyIssued)}
              {demand.source === "manual" ? " · met de hand" : " · uit offerte"}
            </span>
            <IssueForm projectId={project.id} demandId={demand.id} />
          </li>
        ))}
      </ul>
      {articles.length === 0 ? (
        <p className="text-sm text-muted">Maak eerst een artikel.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_auto] sm:items-end">
          <Field label="Artikel">
            <Select value={articleId} onChange={(event) => setArticleId(event.target.value)}>
              {articles.map((article) => (
                <option key={article.id} value={article.id}>
                  {article.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Aantal">
            <Input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} />
          </Field>
          <Button variant="ghost" disabled={pending} onClick={() => void add()}>
            {pending ? "Opslaan…" : "Toevoegen"}
          </Button>
        </div>
      )}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </Panel>
  );
}

function IssueForm({ projectId, demandId }: { projectId: string; demandId: string }) {
  const router = useRouter();
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function issue() {
    const parsed = parseQty(qty);
    if (parsed == null || parsed === "0") {
      setError("Vul een aantal in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await issueMaterialAction({ data: { projectId, demandId, qty: parsed } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        className="w-24"
        inputMode="decimal"
        value={qty}
        onChange={(event) => setQty(event.target.value)}
        aria-label="Aantal uitgeven"
      />
      <Button variant="ghost" disabled={pending} onClick={() => void issue()}>
        {pending ? "Bezig…" : "Uitgeven"}
      </Button>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}
