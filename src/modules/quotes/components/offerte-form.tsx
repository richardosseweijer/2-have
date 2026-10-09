import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { getArticleAction, UNITS, type Article } from "@/modules/articles";
import type { Customer } from "@/modules/customers";
import { Button, ErrorNote, Field, Input, Panel, Select } from "@/components/ui";
import { errorText } from "@/lib/errors";
import {
  applyMarkup,
  bpsToInput,
  centsToInput,
  formatEur,
  markupBpsFromPrices,
  parseEurosToCents,
  parsePercentToBps,
} from "@/lib/money";
import { createQuoteAction } from "../actions";

type LineDraft = {
  key: string;
  articleId: string;
  description: string;
  qty: string;
  unit: string;
  cost: string;
  markup: string;
  price: string;
};

function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    articleId: "",
    description: "",
    qty: "1",
    unit: "stuk",
    cost: "",
    markup: "",
    price: "",
  };
}

function quoteBpsOrZero(value: string): number {
  return parsePercentToBps(value) ?? 0;
}

export function OfferteForm({
  customers,
  articles,
  defaultMarkupBps,
}: {
  customers: Customer[];
  articles: Article[];
  defaultMarkupBps: number;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [markup, setMarkup] = useState(bpsToInput(defaultMarkupBps));
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function patch(key: string, next: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...next } : line)));
  }

  function priceFor(costCents: number, lineMarkup: string, quoteMarkup: string, currentPrice: string): string {
    if (costCents <= 0) return currentPrice;
    const bps = lineMarkup.trim() === "" ? quoteBpsOrZero(quoteMarkup) : parsePercentToBps(lineMarkup);
    if (bps == null) return currentPrice;
    return centsToInput(applyMarkup(costCents, bps));
  }

  function onQuoteMarkup(value: string) {
    setMarkup(value);
    setLines((current) =>
      current.map((line) => {
        if (line.markup.trim() !== "") return line;
        const cost = parseEurosToCents(line.cost);
        if (cost == null || cost <= 0) return line;
        return { ...line, price: centsToInput(applyMarkup(cost, quoteBpsOrZero(value))) };
      }),
    );
  }

  async function onArticle(key: string, articleId: string) {
    patch(key, { articleId });
    if (!articleId) return;
    try {
      const article = await getArticleAction({ data: { id: articleId } });
      const cost = article.costCents;
      const price =
        cost > 0 ? centsToInput(applyMarkup(cost, quoteBpsOrZero(markup))) : centsToInput(article.unitPriceCents);
      patch(key, {
        articleId,
        description: article.name,
        unit: article.unit,
        cost: centsToInput(cost),
        markup: "",
        price,
      });
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  function onLineMarkup(key: string, value: string, cost: string, price: string) {
    const costCents = parseEurosToCents(cost);
    patch(key, {
      markup: value,
      price: costCents == null ? price : priceFor(costCents, value, markup, price),
    });
  }

  function onLinePrice(key: string, value: string, cost: string) {
    const costCents = parseEurosToCents(cost);
    const sell = parseEurosToCents(value);
    let lineMarkup = "";
    if (costCents != null && costCents > 0 && sell != null) {
      const bps = markupBpsFromPrices(costCents, sell);
      const quoteBps = quoteBpsOrZero(markup);
      if (bps != null && bps !== quoteBps) lineMarkup = bpsToInput(bps);
    }
    patch(key, { price: value, markup: lineMarkup });
  }

  function onLineCost(key: string, value: string, line: LineDraft) {
    const costCents = value.trim() === "" ? 0 : parseEurosToCents(value);
    patch(key, {
      cost: value,
      price:
        costCents == null
          ? line.price
          : priceFor(costCents, line.markup, markup, line.price),
    });
  }

  const total = lines.reduce((sum, line) => {
    const cents = parseEurosToCents(line.price);
    const qty = Number(line.qty.replace(",", "."));
    if (cents == null || !Number.isFinite(qty) || qty <= 0) return sum;
    return sum + Math.round(qty * cents);
  }, 0);

  const margin = lines.reduce((sum, line) => {
    const sell = parseEurosToCents(line.price);
    const cost = line.cost.trim() === "" ? 0 : parseEurosToCents(line.cost);
    const qty = Number(line.qty.replace(",", "."));
    if (sell == null || cost == null || !Number.isFinite(qty) || qty <= 0) return sum;
    return sum + Math.round(qty * (sell - cost));
  }, 0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Kies een klant.");
      return;
    }
    if (parsePercentToBps(markup) == null || (parsePercentToBps(markup) ?? -1) < 0) {
      setError("Vul de opslag van de offerte in, bijvoorbeeld 35.");
      return;
    }
    const prepared = [];
    for (const line of lines) {
      const description = line.description.trim();
      const priceEmpty = line.price.trim() === "";
      if (!description && priceEmpty && !line.articleId) continue;
      const cents = parseEurosToCents(line.price);
      const costCents = line.cost.trim() === "" ? 0 : parseEurosToCents(line.cost);
      const lineMarkup = line.markup.trim() === "" ? null : parsePercentToBps(line.markup);
      const qty = Number(line.qty.replace(",", "."));
      if (!description || cents == null || costCents == null || !Number.isFinite(qty) || qty <= 0) {
        setError("Elke regel heeft een omschrijving, een aantal, een inkoop en een verkoopprijs nodig.");
        return;
      }
      if (line.markup.trim() !== "" && lineMarkup == null) {
        setError("De opslag op een regel is een percentage, bijvoorbeeld 10.");
        return;
      }
      prepared.push({
        articleId: line.articleId || null,
        description,
        qty,
        unit: line.unit,
        costCents,
        markupBps: lineMarkup,
        unitPriceCents: cents,
      });
    }
    if (prepared.length < 1) {
      setError("Voeg minstens één regel toe.");
      return;
    }
    setPending(true);
    try {
      const created = await createQuoteAction({ data: { customerId, lines: prepared } });
      await router.navigate({ to: "/offertes/$id", params: { id: created.id } });
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <form className="grid gap-4" onSubmit={onSubmit}>
      <Panel className="grid gap-3 md:grid-cols-2">
        <Field label="Klant">
          <Select value={customerId} onChange={(event) => setCustomerId(event.target.value)} required>
            {customers.length === 0 ? <option value="">Geen klanten</option> : null}
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Opslag op deze offerte (%)" hint="Percentage bovenop de inkoop. Een regel kan afwijken.">
          <Input inputMode="decimal" value={markup} onChange={(event) => onQuoteMarkup(event.target.value)} />
        </Field>
      </Panel>
      <div className="grid gap-3">
        {lines.map((line, index) => (
          <Panel key={line.key} className="grid gap-3">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl">Regel {index + 1}</h2>
              {lines.length > 1 ? (
                <button
                  type="button"
                  className="text-sm text-muted underline-offset-4 hover:underline"
                  onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                >
                  Verwijderen
                </button>
              ) : null}
            </div>
            <Field label="Artikel" hint="Inkoop komt uit het artikel. De verkoopprijs volgt de opslag.">
              <Select value={line.articleId} onChange={(event) => void onArticle(line.key, event.target.value)}>
                <option value="">Vrije regel</option>
                {articles.map((article) => (
                  <option key={article.id} value={article.id}>
                    {article.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="grid gap-3 md:grid-cols-2">
              <Field label="Omschrijving">
                <Input
                  value={line.description}
                  onChange={(event) => patch(line.key, { description: event.target.value })}
                />
              </Field>
              <Field label="Eenheid">
                <Select value={line.unit} onChange={(event) => patch(line.key, { unit: event.target.value })}>
                  {UNITS.map((unit) => (
                    <option key={unit} value={unit}>
                      {unit}
                    </option>
                  ))}
                  {line.unit && !UNITS.includes(line.unit as (typeof UNITS)[number]) ? (
                    <option value={line.unit}>{line.unit}</option>
                  ) : null}
                </Select>
              </Field>
              <Field label="Aantal">
                <Input
                  inputMode="decimal"
                  value={line.qty}
                  onChange={(event) => patch(line.key, { qty: event.target.value })}
                />
              </Field>
              <Field label="Inkoop per eenheid (EUR)">
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={line.cost}
                  onChange={(event) => onLineCost(line.key, event.target.value, line)}
                />
              </Field>
              <Field label="Opslag op deze regel (%)" hint="Leeg betekent: de opslag van de offerte.">
                <Input
                  inputMode="decimal"
                  placeholder={markup || "0"}
                  value={line.markup}
                  onChange={(event) => onLineMarkup(line.key, event.target.value, line.cost, line.price)}
                />
              </Field>
              <Field label="Verkoop per eenheid (EUR)">
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={line.price}
                  onChange={(event) => onLinePrice(line.key, event.target.value, line.cost)}
                />
              </Field>
            </div>
          </Panel>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => setLines((current) => [...current, emptyLine()])}>
          Regel toevoegen
        </Button>
        <div className="text-right">
          <p className="text-lg font-semibold tabular-nums">Totaal {formatEur(total)}</p>
          <p className="text-sm tabular-nums text-muted">Marge {formatEur(margin)}</p>
        </div>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button type="submit" disabled={pending || customers.length === 0}>
        {pending ? "Opslaan…" : "Offerte opslaan"}
      </Button>
    </form>
  );
}
