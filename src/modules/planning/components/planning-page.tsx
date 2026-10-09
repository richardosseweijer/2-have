import { Panel, StatusPill } from "@/components/ui";

export function PlanningPage() {
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-tight">Planning</h1>
        <StatusPill tone="neutral">Later</StatusPill>
      </header>
      <Panel>
        <p className="max-w-xl text-muted">
          Ploegplanning komt later. De tabellen voor ploegleden en inzet staan al klaar. Er is geen
          planningsscherm en geen koppeling met een externe agenda.
        </p>
      </Panel>
    </div>
  );
}
