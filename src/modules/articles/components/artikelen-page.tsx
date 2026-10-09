import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Input, Panel, Select } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { centsToInput, formatEur, formatQty, parseEurosToCents, parseQty } from "@/lib/money";
import { UNITS, type Article, type Category } from "../boundary";
import { createArticleAction, createCategoryAction, deleteCategoryAction, renameCategoryAction, updateArticleAction, adjustStockAction } from "../actions";

export function ArtikelenPage({
  articles,
  categories,
}: {
  articles: Article[];
  categories: Category[];
}) {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Artikelen</h1>
        <p className="mt-1 text-muted">
          Inkoop, verkoop en minimum. Een nieuwe offerte neemt de verkoopprijs over. Oude regels blijven staan.
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <div className="grid content-start gap-4">
          <CategoriesPanel categories={categories} />
          <NewArticleForm categories={categories} />
        </div>
        <Panel className="p-0">
          {articles.length === 0 ? (
            <p className="p-5 text-muted">Nog geen artikelen.</p>
          ) : (
            <ul>
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} categories={categories} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function CategoriesPanel({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Vul een categorienaam in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createCategoryAction({ data: { name } });
      setName("");
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <h2 className="font-display text-2xl">Categorieën</h2>
        <Field label="Nieuwe categorie" hint="Een artikel kan in meerdere categorieën zitten.">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Opslaan…" : "Categorie toevoegen"}
        </Button>
      </form>
      {categories.length > 0 ? (
        <ul className="mt-4 grid gap-3 border-t border-line pt-4">
          {categories.map((category) => (
            <CategoryRow key={category.id} category={category} />
          ))}
        </ul>
      ) : null}
    </Panel>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const router = useRouter();
  const [name, setName] = useState(category.name);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function rename() {
    if (!name.trim()) {
      setError("Vul een categorienaam in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await renameCategoryAction({ data: { categoryId: category.id, name } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  async function remove() {
    if (!window.confirm(`Categorie “${category.name}” verwijderen? Artikelen blijven bestaan.`)) return;
    setPending(true);
    setError(null);
    try {
      await deleteCategoryAction({ data: { categoryId: category.id } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-2">
      <div className="flex items-center gap-2">
        <Input
          aria-label={`Naam van ${category.name}`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Button variant="ghost" disabled={pending} onClick={() => void rename()}>
          Hernoem
        </Button>
        <Button variant="danger" disabled={pending} onClick={() => void remove()}>
          Weg
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </li>
  );
}

function NewArticleForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<(typeof UNITS)[number]>("stuk");
  const [cost, setCost] = useState("");
  const [price, setPrice] = useState("");
  const [minQty, setMinQty] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const unitPriceCents = parseEurosToCents(price);
    const costCents = cost.trim() === "" ? 0 : parseEurosToCents(cost);
    const parsedMin = minQty.trim() === "" ? "0" : parseQty(minQty);
    if (!name.trim() || unitPriceCents == null || costCents == null || parsedMin == null) {
      setError("Vul naam en verkoopprijs in. Inkoop en minimum zijn een getal, of leeg.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createArticleAction({
        data: {
          name,
          unit,
          costCents,
          unitPriceCents,
          minQty: parsedMin,
          categoryIds: selected.filter((id) => categories.some((category) => category.id === id)),
        },
      });
      setName("");
      setCost("");
      setPrice("");
      setMinQty("");
      setSelected([]);
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
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
        <Field label="Inkoop (EUR)" hint="Wat het artikel jou kost. Nog niet op de offerte.">
          <Input inputMode="decimal" placeholder="0,00" value={cost} onChange={(event) => setCost(event.target.value)} />
        </Field>
        <Field label="Verkoop (EUR)" hint="Dit neemt een nieuwe offerte over.">
          <Input
            inputMode="decimal"
            placeholder="0,00"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            required
          />
        </Field>
        <Field label="Minimumvoorraad" hint="Bewaard voor later. Er is nog geen telling.">
          <Input inputMode="decimal" placeholder="0" value={minQty} onChange={(event) => setMinQty(event.target.value)} />
        </Field>
        <CategoryChecks categories={categories} selected={selected} onChange={setSelected} />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Opslaan…" : "Artikel opslaan"}
        </Button>
      </form>
    </Panel>
  );
}

function ArticleCard({ article, categories }: { article: Article; categories: Category[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(article.name);
  const [unit, setUnit] = useState(article.unit);
  const [cost, setCost] = useState(centsToInput(article.costCents));
  const [price, setPrice] = useState(centsToInput(article.unitPriceCents));
  const [minQty, setMinQty] = useState(article.minQty);
  const [selected, setSelected] = useState(article.categories.map((category) => category.id));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    const unitPriceCents = parseEurosToCents(price);
    const costCents = cost.trim() === "" ? 0 : parseEurosToCents(cost);
    const parsedMin = minQty.trim() === "" ? "0" : parseQty(minQty);
    if (!name.trim() || unitPriceCents == null || costCents == null || parsedMin == null) {
      setError("Controleer naam, inkoop, verkoop en minimum.");
      return;
    }
    if (!UNITS.includes(unit as (typeof UNITS)[number])) {
      setError("Onbekende eenheid.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateArticleAction({
        data: {
          articleId: article.id,
          name,
          unit: unit as (typeof UNITS)[number],
          costCents,
          unitPriceCents,
          minQty: parsedMin,
          categoryIds: selected.filter((id) => categories.some((category) => category.id === id)),
        },
      });
      setOpen(false);
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  const categoryNames = article.categories.map((category) => category.name).join(", ");

  return (
    <li className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 md:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{article.name}</p>
          <p className="text-sm text-muted">
            per {article.unit}
            {categoryNames ? ` · ${categoryNames}` : ""}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((current) => !current)}>
          {open ? "Sluit" : "Wijzig"}
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4 lg:grid-cols-7">
        <div>
          <dt className="text-muted">Inkoop</dt>
          <dd className="font-medium tabular-nums">{formatEur(article.costCents)}</dd>
        </div>
        <div>
          <dt className="text-muted">Verkoop</dt>
          <dd className="font-medium tabular-nums">{formatEur(article.unitPriceCents)}</dd>
        </div>
        <div>
          <dt className="text-muted">Minimum</dt>
          <dd className="font-medium tabular-nums">{formatQty(article.minQty)}</dd>
        </div>
        <div>
          <dt className="text-muted">Voorraad</dt>
          <dd className="font-medium tabular-nums">{formatQty(article.onHand)}</dd>
        </div>
        <div>
          <dt className="text-muted">Nodig</dt>
          <dd className="font-medium tabular-nums">{formatQty(article.qtyNeeded)}</dd>
        </div>
        <div>
          <dt className="text-muted">Onderweg</dt>
          <dd className="font-medium tabular-nums">{formatQty(article.qtyUnderway)}</dd>
        </div>
        <div>
          <dt className="text-muted">Bij te bestellen</dt>
          <dd className="font-medium tabular-nums">{formatQty(toBuy(article))}</dd>
        </div>
      </dl>
      {open ? (
        <div className="grid gap-3 border-t border-line pt-3">
          <Field label="Naam">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Eenheid">
            <Select value={unit} onChange={(event) => setUnit(event.target.value)}>
              {UNITS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Inkoop (EUR)">
            <Input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
          </Field>
          <Field label="Verkoop (EUR)">
            <Input inputMode="decimal" value={price} onChange={(event) => setPrice(event.target.value)} />
          </Field>
          <Field label="Minimumvoorraad">
            <Input inputMode="decimal" value={minQty} onChange={(event) => setMinQty(event.target.value)} />
          </Field>
          <CategoryChecks categories={categories} selected={selected} onChange={setSelected} />
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button disabled={pending} onClick={() => void save()}>
            {pending ? "Opslaan…" : "Artikel opslaan"}
          </Button>
        </div>
      ) : null}
      <CountForm article={article} />
    </li>
  );
}

function toBuy(article: Article): string {
  const needed = Number(article.qtyNeeded);
  const min = Number(article.minQty);
  const onHand = Number(article.onHand);
  const underway = Number(article.qtyUnderway);
  const value = Math.max(0, needed + min - onHand - underway);
  return String(Math.round(value * 1000) / 1000);
}

function CountForm({ article }: { article: Article }) {
  const router = useRouter();
  const [counted, setCounted] = useState(article.onHand);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    const parsed = parseQty(counted.trim() === "" ? "0" : counted);
    if (parsed == null) {
      setError("Ongeldige telling.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await adjustStockAction({ data: { articleId: article.id, counted: parsed } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="flex items-center gap-2">
        <Input
          className="w-28"
          aria-label={`Telling voor ${article.name}`}
          inputMode="decimal"
          value={counted}
          onChange={(event) => setCounted(event.target.value)}
        />
        <Button variant="ghost" disabled={pending} onClick={() => void save()}>
          Telling
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

function CategoryChecks({
  categories,
  selected,
  onChange,
}: {
  categories: Category[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (categories.length === 0) return null;
  return (
    <fieldset className="grid gap-1">
      <legend className="text-sm font-medium">Categorieën</legend>
      {categories.map((category) => {
        const checked = selected.includes(category.id);
        return (
          <label key={category.id} className="flex min-h-11 items-center gap-2 text-sm font-normal">
            <input
              type="checkbox"
              className="size-4 accent-navy"
              checked={checked}
              onChange={() =>
                onChange(checked ? selected.filter((id) => id !== category.id) : [...selected, category.id])
              }
            />
            {category.name}
          </label>
        );
      })}
    </fieldset>
  );
}
