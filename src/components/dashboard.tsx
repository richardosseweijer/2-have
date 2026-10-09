import { Link } from "@tanstack/react-router";
import { Panel, StatusPill } from "@/components/ui";
import { formatEur } from "@/lib/money";
import { quoteStatusLabel, type QuoteSummary } from "@/modules/quotes";
import type { OrderSummary } from "@/modules/orders";

const tone = {
  draft: "neutral",
  sent: "warn",
  accepted: "ok",
  rejected: "bad",
} as const;

export function Dashboard({
  orgName,
  customerCount,
  articleCount,
  quotes,
  orders,
}: {
  orgName: string;
  customerCount: number;
  articleCount: number;
  quotes: QuoteSummary[];
  orders: OrderSummary[];
}) {
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-muted">Organisatie</p>
        <h1 className="font-display text-4xl tracking-tight">{orgName}</h1>
      </header>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Klanten" value={String(customerCount)} href="/klanten" />
        <Stat label="Artikelen" value={String(articleCount)} href="/artikelen" />
        <Stat label="Bestellingen" value={String(orders.length)} href="/bestellingen" />
      </div>
      {customerCount === 0 ? (
        <Panel>
          <h2 className="font-display text-2xl">Begin met een klant</h2>
          <p className="mt-1 text-muted">Daarna een artikel, dan een offerte met twee regels.</p>
          <Link to="/klanten" className="mt-3 inline-block text-sm font-semibold text-navy">
            Naar klanten
          </Link>
        </Panel>
      ) : null}
      <Panel className="p-0">
        <div className="flex items-center justify-between px-4 py-3 md:px-5">
          <h2 className="font-display text-2xl">Offertes</h2>
          <Link to="/offertes/new" className="text-sm font-semibold text-navy">
            Nieuwe offerte
          </Link>
        </div>
        {quotes.length === 0 ? (
          <p className="px-4 pb-4 text-muted md:px-5">Nog geen offertes.</p>
        ) : (
          <ul>
            {quotes.slice(0, 6).map((quote) => (
              <li key={quote.id} className="border-t border-line">
                <Link
                  to="/offertes/$id"
                  params={{ id: quote.id }}
                  className="grid gap-1 px-4 py-3 hover:bg-paper md:grid-cols-[8rem_minmax(0,1fr)_auto_auto] md:items-center md:px-5"
                >
                  <span className="font-semibold tabular-nums">{quote.number ?? "Concept"}</span>
                  <span>{quote.customerName}</span>
                  <StatusPill tone={tone[quote.status]}>{quoteStatusLabel[quote.status]}</StatusPill>
                  <span className="tabular-nums md:text-right">{formatEur(quote.totalCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Stat({
  label,
  value,
  href,
}: {
  label: string;
  value: string;
  href: "/klanten" | "/artikelen" | "/bestellingen";
}) {
  return (
    <Link to={href} className="rounded-card border border-line bg-card p-4 hover:bg-paper-2">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-3xl tabular-nums">{value}</p>
    </Link>
  );
}
