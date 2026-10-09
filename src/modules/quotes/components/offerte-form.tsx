import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { getArticleAction, UNITS, type Article } from "@/modules/articles";
import type { Customer } from "@/modules/customers";
import { Button, ErrorNote, Field, Input, Panel, Select } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { centsToInput, formatEur, parseEurosToCents } from "@/lib/money";
import { createQuoteAction } from "../actions";

type LineDraft = {
  key: string;
  articleId: string;
  description: string;
  qty: string;
  unit: string;
  price: string;
};

function emptyLine(): LineDraft {
  return {
    key: crypto.randomUUID(),
    articleId: "",
    description: "",
    qty: "1",
    unit: "stuk",
    price: "",
  };
}

export function OfferteForm({
  customers,
  articles,
}: {
  customers: Customer[];
  articles: Article[];
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(customers[0]?.id ?? "");
  const [lines, setLines] = useState<LineDraft[]>([emptyLine(), emptyLine()]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function patch(key: string, next: Partial<LineDraft>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...next } : line)));
  }

  async function onArticle(key: string, articleId: string) {
    patch(key, { articleId });
    if (!articleId) return;
    try {
      const article = await getArticleAction({ data: { id: articleId } });
      patch(key, {
        articleId,
        description: article.name,
        unit: article.unit,
        price: centsToInput(article.unitPriceCents),
      });
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  const total = lines.reduce((sum, line) => {
    const cents = parseEurosToCents(line.price);
    const qty = Number(line.qty.replace(",", "."));
    if (cents == null || !Number.isFinite(qty) || qty <= 0) return sum;
    return sum + Math.round(qty * cents);
  }, 0);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!customerId) {
      setError("Kies een klant.");
      return;
    }
    const prepared = [];
    for (const line of lines) {
      const description = line.description.trim();
      const priceEmpty = line.price.trim() === "";
      if (!description && priceEmpty && !line.articleId) continue;
      const cents = parseEurosToCents(line.price);
      const qty = Number(line.qty.replace(",", "."));
      if (!description || cents == null || !Number.isFinite(qty) || qty <= 0) {
        setError("Elke regel heeft een omschrijving, een aantal en een prijs nodig.");
        return;
      }
      prepared.push({
        articleId: line.articleId || null,
        description,
        qty,
        unit: line.unit,
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
      <Panel>
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
            <Field label="Artikel" hint="Prijs komt uit het artikel en blijft daarna aanpasbaar.">
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
              <Field label="Prijs per eenheid (EUR)">
                <Input
                  inputMode="decimal"
                  placeholder="0,00"
                  value={line.price}
                  onChange={(event) => patch(line.key, { price: event.target.value })}
                />
              </Field>
            </div>
          </Panel>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          onClick={() => setLines((current) => [...current, emptyLine()])}
        >
          Regel toevoegen
        </Button>
        <p className="text-lg font-semibold tabular-nums">Totaal {formatEur(total)}</p>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button type="submit" disabled={pending || customers.length === 0}>
        {pending ? "Opslaan…" : "Offerte opslaan"}
      </Button>
    </form>
  );
}
