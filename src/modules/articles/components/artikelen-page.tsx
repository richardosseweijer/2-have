import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Input, Panel, Select } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { centsToInput, formatEur, parseEurosToCents } from "@/lib/money";
import { UNITS, type Article } from "../boundary";
import { createArticleAction, updateArticlePriceAction } from "../actions";

export function ArtikelenPage({ articles }: { articles: Article[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("stuk");
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const unitPriceCents = parseEurosToCents(price);
    if (!name.trim() || unitPriceCents == null) {
      setError("Vul een naam en een prijs in euro in, bijvoorbeeld 12,50.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createArticleAction({ data: { name, unit, unitPriceCents } });
      setName("");
      setPrice("");
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Artikelen</h1>
        <p className="mt-1 text-muted">De actuele prijs. Oude offertes en bestellingen blijven staan.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Panel>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <h2 className="font-display text-2xl">Nieuw artikel</h2>
            <Field label="Naam">
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="Eenheid">
              <Select value={unit} onChange={(event) => setUnit(event.target.value as (typeof UNITS)[number])}>
                {UNITS.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Prijs (EUR)">
              <Input
                inputMode="decimal"
                placeholder="0,00"
                value={price}
                onChange={(event) => setPrice(event.target.value)}
                required
              />
            </Field>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Opslaan…" : "Artikel opslaan"}
            </Button>
          </form>
        </Panel>
        <Panel className="p-0">
          {articles.length === 0 ? (
            <p className="p-5 text-muted">Nog geen artikelen.</p>
          ) : (
            <ul>
              {articles.map((article) => (
                <PriceRow key={article.id} article={article} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function PriceRow({ article }: { article: Article }) {
  const router = useRouter();
  const [price, setPrice] = useState(centsToInput(article.unitPriceCents));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    const unitPriceCents = parseEurosToCents(price);
    if (unitPriceCents == null) {
      setError("Ongeldige prijs.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateArticlePriceAction({ data: { articleId: article.id, unitPriceCents } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-3 border-b border-line px-4 py-3 last:border-b-0 md:grid-cols-[minmax(0,1fr)_9rem_auto] md:items-center md:px-5">
      <div>
        <p className="font-semibold">{article.name}</p>
        <p className="text-sm text-muted">per {article.unit}</p>
      </div>
      <p className="font-medium tabular-nums">{formatEur(article.unitPriceCents)}</p>
      <div className="flex items-center gap-2">
        <Input
          className="w-28"
          aria-label={`Nieuwe prijs voor ${article.name}`}
          inputMode="decimal"
          value={price}
          onChange={(event) => setPrice(event.target.value)}
        />
        <Button variant="ghost" disabled={pending} onClick={() => void save()}>
          Prijs
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </li>
  );
}
