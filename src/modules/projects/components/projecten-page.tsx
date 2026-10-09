import { Panel, StatusPill } from "@/components/ui";

export function ProjectenPage() {
  return (
    <div className="grid gap-4">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="font-display text-4xl tracking-tight">Projecten</h1>
        <StatusPill tone="neutral">Later</StatusPill>
      </header>
      <Panel>
        <p className="max-w-xl text-muted">
          Projectplanning komt later. De tabel voor projecten staat al klaar, zodat deze module later
          kan aanhaken zonder een tweede database.
        </p>
      </Panel>
    </div>
  );
}
