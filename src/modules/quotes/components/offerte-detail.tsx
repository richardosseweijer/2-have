import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Panel, StatusPill } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { formatEur, formatQty } from "@/lib/money";
import { quoteStatusLabel, type QuoteDetail } from "../boundary";
import { acceptQuoteAction, markQuoteSentAction, rejectQuoteAction } from "../actions";

const tone = {
  draft: "neutral",
  sent: "warn",
  accepted: "ok",
  rejected: "bad",
} as const;

export function OfferteDetail({ quote }: { quote: QuoteDetail }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);
  const open = quote.status === "draft" || quote.status === "sent";

  async function run(kind: "send" | "accept" | "reject") {
    setError(null);
    setPending(kind);
    try {
      if (kind === "send") {
        await markQuoteSentAction({ data: { id: quote.id } });
        await router.invalidate();
      } else if (kind === "reject") {
        await rejectQuoteAction({ data: { id: quote.id } });
        await router.invalidate();
      } else {
        const result = await acceptQuoteAction({ data: { id: quote.id } });
        await router.navigate({ to: "/bestellingen/$id", params: { id: result.orderId } });
      }
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{quote.createdOn}</p>
          <h1 className="font-display text-4xl tracking-tight">{quote.number ?? "Concept"}</h1>
          <p className="mt-1 text-muted">{quote.customerName}</p>
        </div>
        <StatusPill tone={tone[quote.status]}>{quoteStatusLabel[quote.status]}</StatusPill>
      </header>
      <Panel className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-2 font-medium md:px-5">Omschrijving</th>
              <th className="px-2 py-2 font-medium">Aantal</th>
              <th className="px-2 py-2 font-medium">Prijs</th>
              <th className="px-4 py-2 text-right font-medium md:px-5">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((line) => (
              <tr key={line.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3 md:px-5">
                  <p className="font-medium">{line.description}</p>
                  <p className="text-muted">{line.unit}</p>
                </td>
                <td className="px-2 py-3 tabular-nums">{formatQty(line.qty)}</td>
                <td className="px-2 py-3 tabular-nums">{formatEur(line.unitPriceCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums md:px-5">{formatEur(line.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-4 text-right text-lg font-semibold tabular-nums md:px-5">
          Totaal {formatEur(quote.totalCents)}
        </p>
      </Panel>
      <p className="text-sm text-muted">
        Prijzen zijn vastgezet op de regels. Een latere wijziging van het artikel herschrijft deze offerte niet.
      </p>
      {quote.orderId ? (
        <Link to="/bestellingen/$id" params={{ id: quote.orderId }} className="text-sm font-semibold text-navy">
          Bestelling {quote.orderNumber}
        </Link>
      ) : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {open ? (
        <div className="flex flex-wrap gap-2">
          {quote.status === "draft" ? (
            <Button variant="ghost" disabled={pending !== null} onClick={() => void run("send")}>
              {pending === "send" ? "Bezig…" : "Markeer als verzonden"}
            </Button>
          ) : null}
          <Button disabled={pending !== null} onClick={() => void run("accept")}>
            {pending === "accept" ? "Bezig…" : "Accepteren"}
          </Button>
          <Button variant="danger" disabled={pending !== null} onClick={() => void run("reject")}>
            {pending === "reject" ? "Bezig…" : "Afwijzen"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
