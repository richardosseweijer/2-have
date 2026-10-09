import { Link } from "@tanstack/react-router";
import { Button, Panel, StatusPill } from "@/components/ui";
import { formatEur } from "@/lib/money";
import { quoteStatusLabel, type QuoteSummary } from "../boundary";

const tone = {
  draft: "neutral",
  sent: "warn",
  accepted: "ok",
  rejected: "bad",
} as const;

export function OffertesPage({ quotes }: { quotes: QuoteSummary[] }) {
  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-4xl tracking-tight">Offertes</h1>
          <p className="mt-1 text-muted">Een nummer komt pas bij accepteren: OFF-0001.</p>
        </div>
        <Link to="/offertes/new">
          <Button>Nieuwe offerte</Button>
        </Link>
      </header>
      <Panel className="p-0">
        {quotes.length === 0 ? (
          <p className="p-5 text-muted">Nog geen offertes.</p>
        ) : (
          <ul>
            {quotes.map((quote) => (
              <li key={quote.id} className="border-b border-line last:border-b-0">
                <Link
                  to="/offertes/$id"
                  params={{ id: quote.id }}
                  className="grid gap-1 px-4 py-3 hover:bg-paper md:grid-cols-[7rem_minmax(0,1fr)_auto_auto_auto] md:items-center md:gap-4 md:px-5"
                >
                  <span className="font-semibold tabular-nums">{quote.number ?? "Concept"}</span>
                  <span>{quote.customerName}</span>
                  <StatusPill tone={tone[quote.status]}>{quoteStatusLabel[quote.status]}</StatusPill>
                  <span className="tabular-nums md:text-right">{formatEur(quote.totalCents)}</span>
                  <span className="text-sm tabular-nums text-muted md:text-right">
                    Marge {formatEur(quote.marginCents)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
