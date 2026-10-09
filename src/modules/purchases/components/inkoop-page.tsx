import { useState, type FormEvent } from "react";
import { Link, useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Input, Panel, Select, StatusPill } from "@/components/ui";
import { errorText } from "@/lib/errors";
import {
  purchaseStatusLabel,
  type PurchasingBoard,
  type Supplier,
} from "../boundary";
import { createPurchaseAction, createSupplierAction, updateSupplierAction } from "../actions";

const tone = {
  draft: "neutral",
  ordered: "warn",
  partial: "warn",
  received: "ok",
  cancelled: "bad",
} as const;

export function InkoopPage({ board }: { board: PurchasingBoard }) {
  const active = board.suppliers.filter((supplier) => supplier.active);
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Inkoop</h1>
        <p className="mt-1 text-muted">Bestellen bij een leverancier. Een concept telt nog niet als onderweg.</p>
      </header>
      <Panel>
        <h2 className="font-display text-2xl">Binnen 7 dagen</h2>
        {board.arrivals.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Geen levering verwacht, en niets te laat.</p>
        ) : (
          <ul className="mt-2">
            {board.arrivals.map((arrival) => (
              <li key={arrival.id} className="border-t border-line">
                <Link
                  to="/inkoop/$id"
                  params={{ id: arrival.id }}
                  className="flex flex-wrap items-center justify-between gap-2 py-3"
                >
                  <span>
                    <span className="font-semibold tabular-nums">{arrival.number}</span>
                    <span className="text-muted"> · {arrival.supplierName}</span>
                  </span>
                  <span className="text-sm font-semibold tabular-nums">
                    {arrival.late ? "Te laat" : arrival.expectedOn}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <NewOrder suppliers={active} />
        <Panel className="p-0">
          {board.orders.length === 0 ? (
            <p className="p-5 text-muted">Nog geen inkooporders.</p>
          ) : (
            <ul>
              {board.orders.map((order) => (
                <li key={order.id} className="border-b border-line last:border-b-0">
                  <Link
                    to="/inkoop/$id"
                    params={{ id: order.id }}
                    className="grid gap-1 px-4 py-3 hover:bg-paper md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-5"
                  >
                    <span>
                      <span className="font-semibold tabular-nums">{order.number ?? "Concept"}</span>
                      <span className="mt-0.5 block text-sm text-muted">
                        {order.supplierName}
                        {order.expectedOn ? ` · ${order.expectedOn}` : ""}
                      </span>
                    </span>
                    <StatusPill tone={tone[order.status]}>{purchaseStatusLabel[order.status]}</StatusPill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
      <Suppliers suppliers={board.suppliers} />
    </div>
  );
}

function NewOrder({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [supplierId, setSupplierId] = useState("");
  const chosen = suppliers.some((supplier) => supplier.id === supplierId) ? supplierId : (suppliers[0]?.id ?? "");
  const [expectedOn, setExpectedOn] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!chosen) {
      setError("Kies een leverancier.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const created = await createPurchaseAction({ data: { supplierId: chosen, expectedOn } });
      await router.navigate({ to: "/inkoop/$id", params: { id: created.id } });
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <Panel>
      <form className="grid gap-3" onSubmit={onSubmit}>
        <h2 className="font-display text-2xl">Nieuwe order</h2>
        {suppliers.length === 0 ? (
          <p className="text-sm text-muted">Voeg eerst een leverancier toe.</p>
        ) : (
          <>
            <Field label="Leverancier">
              <Select value={chosen} onChange={(event) => setSupplierId(event.target.value)}>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Leverdatum" hint="Nodig voordat je de order plaatst.">
              <Input type="date" value={expectedOn} onChange={(event) => setExpectedOn(event.target.value)} />
            </Field>
          </>
        )}
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" disabled={pending || suppliers.length === 0}>
          {pending ? "Opslaan…" : "Inkooporder"}
        </Button>
      </form>
    </Panel>
  );
}

function Suppliers({ suppliers }: { suppliers: Supplier[] }) {
  return (
    <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
      <NewSupplier />
      <Panel className="p-0">
        <h2 className="px-4 pt-4 font-display text-2xl md:px-5">Leveranciers</h2>
        {suppliers.length === 0 ? (
          <p className="p-5 text-muted">Nog geen leveranciers.</p>
        ) : (
          <ul>
            {suppliers.map((supplier) => (
              <SupplierCard key={supplier.id} supplier={supplier} />
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function NewSupplier() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Vul een naam in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createSupplierAction({ data: { name, phone, email, notes } });
      setName("");
      setPhone("");
      setEmail("");
      setNotes("");
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
        <h2 className="font-display text-2xl">Leverancier</h2>
        <Field label="Naam">
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <Field label="Telefoon">
          <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input value={email} onChange={(event) => setEmail(event.target.value)} />
        </Field>
        <Field label="Notitie">
          <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" variant="ghost" disabled={pending}>
          {pending ? "Opslaan…" : "Leverancier opslaan"}
        </Button>
      </form>
    </Panel>
  );
}

function SupplierCard({ supplier }: { supplier: Supplier }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(supplier.name);
  const [phone, setPhone] = useState(supplier.phone);
  const [email, setEmail] = useState(supplier.email);
  const [notes, setNotes] = useState(supplier.notes);
  const [active, setActive] = useState(supplier.active);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    if (!name.trim()) {
      setError("Vul een naam in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await updateSupplierAction({
        data: { supplierId: supplier.id, name, phone, email, notes, active },
      });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="border-t border-line px-4 py-3 md:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{supplier.name}</p>
          <p className="text-sm text-muted">
            {[supplier.phone, supplier.email].filter(Boolean).join(" · ") || "Geen contact"}
            {supplier.active ? "" : " · inactief"}
          </p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((current) => !current)}>
          {open ? "Sluit" : "Wijzig"}
        </Button>
      </div>
      {open ? (
        <div className="mt-3 grid gap-3">
          <Field label="Naam">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </Field>
          <Field label="Telefoon">
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
          </Field>
          <Field label="E-mail">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} />
          </Field>
          <Field label="Notitie">
            <Input value={notes} onChange={(event) => setNotes(event.target.value)} />
          </Field>
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-navy"
              checked={active}
              onChange={(event) => setActive(event.target.checked)}
            />
            Actief
          </label>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button variant="ghost" disabled={pending} onClick={() => void save()}>
            {pending ? "Opslaan…" : "Opslaan"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}
