import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Input, Panel } from "@/components/ui";
import { errorText } from "@/lib/errors";
import type { Customer } from "../boundary";
import { createCustomerAction } from "../actions";

export function KlantenPage({ customers }: { customers: Customer[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Vul een naam in.");
      return;
    }
    setPending(true);
    try {
      await createCustomerAction({
        data: { name, email, phone, city },
      });
      setName("");
      setEmail("");
      setPhone("");
      setCity("");
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
        <h1 className="font-display text-4xl tracking-tight">Klanten</h1>
        <p className="mt-1 text-muted">Wie je een offerte stuurt.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[18rem_minmax(0,1fr)]">
        <Panel>
          <form className="grid gap-3" onSubmit={onSubmit}>
            <h2 className="font-display text-2xl">Nieuwe klant</h2>
            <Field label="Naam">
              <Input value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="off"
              />
            </Field>
            <Field label="Telefoon">
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="Plaats">
              <Input value={city} onChange={(event) => setCity(event.target.value)} />
            </Field>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Opslaan…" : "Klant opslaan"}
            </Button>
          </form>
        </Panel>
        <Panel className="p-0">
          {customers.length === 0 ? (
            <p className="p-5 text-muted">Nog geen klanten.</p>
          ) : (
            <ul>
              {customers.map((customer) => (
                <li key={customer.id} className="border-b border-line px-4 py-3 last:border-b-0 md:px-5">
                  <p className="font-semibold">{customer.name}</p>
                  <p className="text-sm text-muted">
                    {[customer.city, customer.email, customer.phone].filter(Boolean).join(" · ") || "Geen gegevens"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}
