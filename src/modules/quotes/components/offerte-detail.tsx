import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Input, Panel, StatusPill } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { applyMarkup, bpsToInput, centsToInput, formatEur, formatQty, markupBpsFromPrices, parseEurosToCents, parsePercentToBps } from "@/lib/money";
import { quoteStatusLabel, type QuoteDetail, type QuoteLine } from "../boundary";
import { acceptQuoteAction, markQuoteSentAction, rejectQuoteAction, updateQuotePricingAction } from "../actions";

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
      <MarginPanel
        key={`${quote.markupBps}:${quote.lines.map((line) => `${line.id}:${line.costCents}:${line.markupBps}:${line.unitPriceCents}`).join("|")}`}
        quote={quote}
        open={open}
      />
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

function MarginPanel({ quote, open }: { quote: QuoteDetail; open: boolean }) {
  const router = useRouter();
  const [markup, setMarkup] = useState(bpsToInput(quote.markupBps));
  const [lines, setLines] = useState(() => quote.lines.map(lineDraft));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function patch(id: string, next: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...next } : line)));
  }

  async function save() {
    const quoteBps = parsePercentToBps(markup);
    if (quoteBps == null || quoteBps < 0) {
      setError("Vul de opslag van de offerte in, bijvoorbeeld 35.");
      return;
    }
    const prepared = [];
    for (const line of lines) {
      const costCents = parseEurosToCents(line.cost);
      const unitPriceCents = parseEurosToCents(line.price);
      const lineMarkup = line.markup.trim() === "" ? null : parsePercentToBps(line.markup);
      if (costCents == null || unitPriceCents == null || (line.markup.trim() !== "" && lineMarkup == null)) {
        setError("Controleer inkoop, opslag en verkoop.");
        return;
      }
      prepared.push({ lineId: line.id, costCents, markupBps: lineMarkup, unitPriceCents });
    }
    setPending(true);
    setError(null);
    try {
      await updateQuotePricingAction({ data: { quoteId: quote.id, markupBps: quoteBps, lines: prepared } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  const margin = lines.reduce((sum, line) => {
    const source = quote.lines.find((item) => item.id === line.id);
    if (!open && source) return sum + source.marginCents;
    const sell = parseEurosToCents(line.price);
    const cost = parseEurosToCents(line.cost);
    const qty = Number(source?.qty ?? "0");
    if (sell == null || cost == null || !Number.isFinite(qty)) return sum;
    return sum + Math.round(qty * (sell - cost));
  }, 0);

  return (
    <Panel className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl">Marge</h2>
          <p className="text-sm text-muted">Alleen voor jou. De klant ziet dit niet.</p>
        </div>
        <p className="text-lg font-semibold tabular-nums">Marge {formatEur(open ? margin : quote.marginCents)}</p>
      </div>
      {open ? (
        <Field label="Opslag op deze offerte (%)">
          <Input
            inputMode="decimal"
            value={markup}
            onChange={(event) => {
              const value = event.target.value;
              setMarkup(value);
              const bps = parsePercentToBps(value);
              if (bps == null || bps < 0) return;
              setLines((current) =>
                current.map((line) => {
                  if (line.markup.trim() !== "") return line;
                  const cost = parseEurosToCents(line.cost);
                  if (cost == null || cost <= 0) return line;
                  return { ...line, price: centsToInput(applyMarkup(cost, bps)) };
                }),
              );
            }}
          />
        </Field>
      ) : (
        <p className="text-sm text-muted">Opslag op de offerte: {bpsToInput(quote.markupBps)}%</p>
      )}
      <ul className="grid gap-3">
        {quote.lines.map((line) => {
          const draft = lines.find((item) => item.id === line.id);
          return (
            <li key={line.id} className="grid gap-2 border-t border-line pt-3">
              <p className="font-medium">{line.description}</p>
              {open && draft ? (
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="Inkoop (EUR)">
                    <Input
                      inputMode="decimal"
                      value={draft.cost}
                      onChange={(event) => {
                        const cost = event.target.value;
                        const costCents = parseEurosToCents(cost);
                        const quoteBps = parsePercentToBps(markup) ?? quote.markupBps;
                        const own = draft.markup.trim() === "" ? null : parsePercentToBps(draft.markup);
                        const bps = own ?? quoteBps;
                        patch(line.id, {
                          cost,
                          price:
                            costCents != null && costCents > 0
                              ? centsToInput(applyMarkup(costCents, bps))
                              : draft.price,
                        });
                      }}
                    />
                  </Field>
                  <Field label="Opslag (%)" hint="Leeg = offerte">
                    <Input
                      inputMode="decimal"
                      value={draft.markup}
                      onChange={(event) => {
                        const value = event.target.value;
                        const costCents = parseEurosToCents(draft.cost);
                        const own = value.trim() === "" ? null : parsePercentToBps(value);
                        const bps = own ?? (parsePercentToBps(markup) ?? quote.markupBps);
                        patch(line.id, {
                          markup: value,
                          price:
                            costCents != null && costCents > 0 ? centsToInput(applyMarkup(costCents, bps)) : draft.price,
                        });
                      }}
                    />
                  </Field>
                  <Field label="Verkoop (EUR)">
                    <Input
                      inputMode="decimal"
                      value={draft.price}
                      onChange={(event) => {
                        const price = event.target.value;
                        const costCents = parseEurosToCents(draft.cost);
                        const sell = parseEurosToCents(price);
                        const quoteBps = parsePercentToBps(markup) ?? quote.markupBps;
                        let lineMarkup = "";
                        if (costCents != null && costCents > 0 && sell != null) {
                          const bps = markupBpsFromPrices(costCents, sell);
                          if (bps != null && bps !== quoteBps) lineMarkup = bpsToInput(bps);
                        }
                        patch(line.id, { price, markup: lineMarkup });
                      }}
                    />
                  </Field>
                </div>
              ) : (
                <p className="text-sm tabular-nums text-muted">
                  Inkoop {formatEur(line.costCents)} · Opslag {lineLabel(line, quote.markupBps)} · Verkoop{" "}
                  {formatEur(line.unitPriceCents)} · Marge {formatEur(line.marginCents)}
                </p>
              )}
            </li>
          );
        })}
      </ul>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {open ? (
        <Button variant="ghost" disabled={pending} onClick={() => void save()}>
          {pending ? "Opslaan…" : "Marge opslaan"}
        </Button>
      ) : null}
    </Panel>
  );
}

type LineDraft = { id: string; cost: string; markup: string; price: string };

function lineDraft(line: QuoteLine): LineDraft {
  return {
    id: line.id,
    cost: centsToInput(line.costCents),
    markup: line.markupBps == null ? "" : bpsToInput(line.markupBps),
    price: centsToInput(line.unitPriceCents),
  };
}

function lineLabel(line: QuoteLine, quoteMarkupBps: number): string {
  if (line.markupBps == null) return `offerte ${bpsToInput(quoteMarkupBps)}%`;
  return `${bpsToInput(line.markupBps)}%`;
}
