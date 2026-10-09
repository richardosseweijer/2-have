import { Link } from "@tanstack/react-router";
import { DefaultMarkupForm } from "@/modules/identity/components/default-markup-form";
import { Panel, StatusPill } from "@/components/ui";
import { formatEur, formatQty } from "@/lib/money";
import type { LateMaterial } from "@/lib/coverage";
import { quoteStatusLabel, type QuoteSummary } from "@/modules/quotes";
import type { OrderSummary } from "@/modules/orders";
import type { StaffingGap } from "@/modules/planning";

const tone = {
  draft: "neutral",
  sent: "warn",
  accepted: "ok",
  rejected: "bad",
} as const;

export function Dashboard({
  orgName,
  defaultMarkupBps,
  customerCount,
  articleCount,
  quotes,
  orders,
  lateMaterials,
  staffingGaps,
}: {
  orgName: string;
  defaultMarkupBps: number;
  customerCount: number;
  articleCount: number;
  quotes: QuoteSummary[];
  orders: OrderSummary[];
  lateMaterials: LateMaterial[];
  staffingGaps: StaffingGap[];
}) {
  return (
    <div className="grid gap-6">
      <header>
        <p className="text-sm text-muted">Organisatie</p>
        <h1 className="font-display text-4xl tracking-tight">{orgName}</h1>
        <DefaultMarkupForm markupBps={defaultMarkupBps} />
      </header>
      <div className="grid gap-3 lg:grid-cols-2">
        <Panel>
          <h2 className="font-display text-2xl">Materiaal, 7 dagen</h2>
          {lateMaterials.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Niets te laat. Wat onderweg is en op tijd komt telt mee.</p>
          ) : (
            <ul className="mt-2">
              {lateMaterials.map((row) => (
                <li key={`${row.projectId}-${row.articleId}`} className="border-t border-line">
                  <Link
                    to="/projecten/$id"
                    params={{ id: row.projectId }}
                    className="block py-3"
                  >
                    <span className="font-semibold">{row.description}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {row.projectName} · {row.earliestDate} · tekort {formatQty(row.qtyShort)} {row.unit}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel>
          <h2 className="font-display text-2xl">Bemanning, 7 dagen</h2>
          {staffingGaps.length === 0 ? (
            <p className="mt-2 text-sm text-muted">Geen dag onderbezet. Alleen bevestigde mensen tellen.</p>
          ) : (
            <ul className="mt-2">
              {staffingGaps.map((day) => (
                <li key={`${day.projectId}-${day.workDate}`} className="border-t border-line">
                  <Link to="/planning" className="block py-3">
                    <span className="font-semibold">{day.projectName}</span>
                    <span className="mt-0.5 block text-sm text-muted">
                      {day.workDate} · {day.confirmed} van {day.requiredCrew} bevestigd
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
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
