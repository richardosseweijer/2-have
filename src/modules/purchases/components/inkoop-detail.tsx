import { useState } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import type { Article } from "@/modules/articles";
import { Button, ErrorNote, Field, Input, Panel, Select, StatusPill } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { centsToInput, formatEur, formatQty, parseEurosToCents, parseQty } from "@/lib/money";
import { purchaseStatusLabel, type PurchaseDetail } from "../boundary";
import {
  addPurchaseLineAction,
  cancelPurchaseAction,
  placePurchaseAction,
  receivePurchaseLineAction,
  removePurchaseLineAction,
  setPurchaseExpectedAction,
} from "../actions";

const tone = {
  draft: "neutral",
  ordered: "warn",
  partial: "warn",
  received: "ok",
  cancelled: "bad",
} as const;

export function InkoopDetailPage({ purchase, articles }: { purchase: PurchaseDetail; articles: Article[] }) {
  const open = purchase.status === "draft" || purchase.status === "ordered" || purchase.status === "partial";
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/inkoop" className="text-sm text-muted">
            Terug naar inkoop
          </Link>
          <h1 className="font-display text-4xl tracking-tight">{purchase.number ?? "Concept"}</h1>
          <p className="mt-1 text-muted">{purchase.supplierName}</p>
        </div>
        <StatusPill tone={tone[purchase.status]}>{purchaseStatusLabel[purchase.status]}</StatusPill>
      </header>
      <ExpectedForm purchase={purchase} />
      <Panel className="grid gap-3">
        <h2 className="font-display text-2xl">Regels</h2>
        <p className="text-sm text-muted">De inkoopprijs op de regel blijft staan. Het artikel en offertes veranderen niet.</p>
        {purchase.lines.length === 0 ? <p className="text-sm text-muted">Nog geen regels.</p> : null}
        <ul>
          {purchase.lines.map((line) => (
            <li key={line.id} className="border-t border-line py-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p>
                  <span className="font-medium">{line.description}</span>
                  <span className="text-muted">
                    {" "}
                    · {formatQty(line.qtyOrdered)} {line.unit} · binnen {formatQty(line.qtyReceived)} ·{" "}
                    {formatEur(line.unitCostCents)}
                  </span>
                </p>
                {purchase.status === "draft" ? <RemoveLine purchaseId={purchase.id} lineId={line.id} /> : null}
              </div>
              {purchase.status === "ordered" || purchase.status === "partial" ? (
                <ReceiveForm purchaseId={purchase.id} lineId={line.id} />
              ) : null}
            </li>
          ))}
        </ul>
        {purchase.status === "draft" ? <AddLine purchaseId={purchase.id} articles={articles} /> : null}
      </Panel>
      {purchase.status === "draft" ? <PlaceForm purchaseId={purchase.id} /> : null}
      {open ? <CancelForm purchaseId={purchase.id} /> : null}
    </div>
  );
}

function ExpectedForm({ purchase }: { purchase: PurchaseDetail }) {
  const router = useRouter();
  const locked = purchase.status === "received" || purchase.status === "cancelled";
  const [expectedOn, setExpectedOn] = useState(purchase.expectedOn ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    setPending(true);
    setError(null);
    try {
      await setPurchaseExpectedAction({ data: { purchaseId: purchase.id, expectedOn } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="grid gap-3 sm:grid-cols-[16rem_auto] sm:items-end">
      <Field label="Leverdatum">
        <Input
          type="date"
          value={expectedOn}
          disabled={locked}
          onChange={(event) => setExpectedOn(event.target.value)}
        />
      </Field>
      {locked ? null : (
        <Button variant="ghost" disabled={pending} onClick={() => void save()}>
          {pending ? "Opslaan…" : "Datum opslaan"}
        </Button>
      )}
      {error ? <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
    </Panel>
  );
}

function AddLine({ purchaseId, articles }: { purchaseId: string; articles: Article[] }) {
  const router = useRouter();
  const [articleId, setArticleId] = useState(articles[0]?.id ?? "");
  const [qty, setQty] = useState("1");
  const [cost, setCost] = useState(articles[0] ? centsToInput(articles[0].costCents) : "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function pick(id: string) {
    setArticleId(id);
    const article = articles.find((item) => item.id === id);
    if (article) setCost(centsToInput(article.costCents));
  }

  async function add() {
    const parsed = parseQty(qty);
    const unitCostCents = parseEurosToCents(cost);
    if (!articleId || parsed == null || parsed === "0" || unitCostCents == null) {
      setError("Kies een artikel, een aantal en een inkoopprijs.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await addPurchaseLineAction({ data: { purchaseId, articleId, qty: parsed, unitCostCents } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  if (articles.length === 0) return <p className="text-sm text-muted">Maak eerst een artikel.</p>;

  return (
    <div className="grid gap-3 border-t border-line pt-3">
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_8rem_8rem_auto] sm:items-end">
        <Field label="Artikel">
          <Select value={articleId} onChange={(event) => pick(event.target.value)}>
            {articles.map((article) => (
              <option key={article.id} value={article.id}>
                {article.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Aantal">
          <Input inputMode="decimal" value={qty} onChange={(event) => setQty(event.target.value)} />
        </Field>
        <Field label="Inkoop">
          <Input inputMode="decimal" value={cost} onChange={(event) => setCost(event.target.value)} />
        </Field>
        <Button variant="ghost" disabled={pending} onClick={() => void add()}>
          {pending ? "Opslaan…" : "Toevoegen"}
        </Button>
      </div>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

function RemoveLine({ purchaseId, lineId }: { purchaseId: string; lineId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function remove() {
    setError(null);
    try {
      await removePurchaseLineAction({ data: { purchaseId, lineId } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    }
  }

  return (
    <span className="grid justify-items-end gap-1">
      <Button variant="danger" onClick={() => void remove()}>
        Weg
      </Button>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </span>
  );
}

function ReceiveForm({ purchaseId, lineId }: { purchaseId: string; lineId: string }) {
  const router = useRouter();
  const [qty, setQty] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function receive() {
    const parsed = parseQty(qty);
    if (parsed == null || parsed === "0") {
      setError("Vul een aantal in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await receivePurchaseLineAction({ data: { purchaseId, lineId, qty: parsed } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      <Input
        className="w-24"
        inputMode="decimal"
        value={qty}
        onChange={(event) => setQty(event.target.value)}
        aria-label="Aantal ontvangen"
      />
      <Button variant="ghost" disabled={pending} onClick={() => void receive()}>
        {pending ? "Bezig…" : "Ontvangen"}
      </Button>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
    </div>
  );
}

function PlaceForm({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function place() {
    setPending(true);
    setError(null);
    try {
      await placePurchaseAction({ data: { purchaseId } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="grid gap-3">
      <p className="text-sm text-muted">Plaatsen geeft een nummer. Daarna telt de order mee als onderweg.</p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button disabled={pending} onClick={() => void place()}>
        {pending ? "Bezig…" : "Bestellen"}
      </Button>
    </Panel>
  );
}

function CancelForm({ purchaseId }: { purchaseId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function cancel() {
    setPending(true);
    setError(null);
    try {
      await cancelPurchaseAction({ data: { purchaseId } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <Panel className="grid gap-3">
      <p className="text-sm text-muted">Annuleren haalt de order van onderweg. Wat al binnen is blijft op de plank.</p>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <Button variant="danger" disabled={pending} onClick={() => void cancel()}>
        {pending ? "Bezig…" : "Order annuleren"}
      </Button>
    </Panel>
  );
}
