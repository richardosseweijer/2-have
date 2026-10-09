import { useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import type { Customer } from "@/modules/customers";
import { Button, ErrorNote, Field, Input, Panel, Select, StatusPill } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { projectStatusLabel, type ProjectSummary } from "../boundary";
import { createProjectAction } from "../actions";

const tone = {
  planned: "neutral",
  in_progress: "warn",
  done: "ok",
  cancelled: "bad",
} as const;

export function ProjectenPage({
  projects,
  customers,
}: {
  projects: ProjectSummary[];
  customers: Customer[];
}) {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Projecten</h1>
        <p className="mt-1 text-muted">Een leeg project, of automatisch bij het accepteren van een offerte.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <NewProject customers={customers} />
        <Panel className="p-0">
          {projects.length === 0 ? (
            <p className="p-5 text-muted">Nog geen projecten.</p>
          ) : (
            <ul>
              {projects.map((project) => (
                <li key={project.id} className="border-b border-line last:border-b-0">
                  <Link
                    to="/projecten/$id"
                    params={{ id: project.id }}
                    className="grid gap-1 px-4 py-3 hover:bg-paper md:grid-cols-[minmax(0,1fr)_auto_auto] md:items-center md:px-5"
                  >
                    <span>
                      <span className="font-semibold">{project.name}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {project.customerName ?? "Geen klant"}
                        {project.nextDate ? ` · ${project.nextDate}` : ""}
                      </span>
                    </span>
                    <StatusPill tone={tone[project.status]}>{projectStatusLabel[project.status]}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function NewProject({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Vul een projectnaam in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createProjectAction({
        data: { name, customerId: customerId || null },
      });
      await router.navigate({ to: "/projecten/$id", params: { id: created.id } });
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <Panel>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <h2 className="font-display text-2xl">Leeg project</h2>
        <Field label="Naam">
          <Input value={name} onChange={(event) => setName(event.target.value)} required />
        </Field>
        <Field label="Klant" hint="Mag leeg. Je koppelt later geen tweede offerte.">
          <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)}>
            <option value="">Geen klant</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Opslaan…" : "Project aanmaken"}
        </Button>
      </form>
    </Panel>
  );
}
