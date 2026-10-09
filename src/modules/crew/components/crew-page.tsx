import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Input, Panel, Select } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { crewKindLabel, crewKinds, type CrewKind, type CrewMember } from "../boundary";
import { createCrewAction, updateCrewAction } from "../actions";

export function CrewPage({ crew }: { crew: CrewMember[] }) {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Crew</h1>
        <p className="mt-1 text-muted">Vast en freelancers. Iemand die stopt blijft in de lijst, inactief.</p>
      </header>
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <NewPerson />
        <Panel className="p-0">
          {crew.length === 0 ? (
            <p className="p-5 text-muted">Nog niemand.</p>
          ) : (
            <ul>
              {crew.map((person) => (
                <PersonCard key={person.id} person={person} />
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  );
}

function NewPerson() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [kind, setKind] = useState<CrewKind>("employee");
  const [company, setCompany] = useState("");
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
      await createCrewAction({ data: { name, phone, email, kind, company, notes } });
      setName("");
      setPhone("");
      setEmail("");
      setCompany("");
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
        <h2 className="font-display text-2xl">Nieuw</h2>
        <PersonFields
          name={name}
          phone={phone}
          email={email}
          kind={kind}
          company={company}
          notes={notes}
          onName={setName}
          onPhone={setPhone}
          onEmail={setEmail}
          onKind={setKind}
          onCompany={setCompany}
          onNotes={setNotes}
        />
        {error ? <ErrorNote>{error}</ErrorNote> : null}
        <Button type="submit" disabled={pending}>
          {pending ? "Opslaan…" : "Persoon opslaan"}
        </Button>
      </form>
    </Panel>
  );
}

function PersonCard({ person }: { person: CrewMember }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(person.name);
  const [phone, setPhone] = useState(person.phone);
  const [email, setEmail] = useState(person.email);
  const [kind, setKind] = useState(person.kind);
  const [company, setCompany] = useState(person.company);
  const [notes, setNotes] = useState(person.notes);
  const [active, setActive] = useState(person.active);
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
      await updateCrewAction({
        data: { crewMemberId: person.id, name, phone, email, kind, company, notes, active },
      });
      setOpen(false);
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <li className="grid gap-3 border-b border-line px-4 py-4 last:border-b-0 md:px-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`font-semibold ${person.active ? "" : "text-muted"}`}>{person.name}</p>
          <p className="text-sm text-muted">
            {crewKindLabel[person.kind]}
            {person.company ? ` · ${person.company}` : ""}
            {person.active ? "" : " · inactief"}
          </p>
          <p className="text-sm text-muted">{[person.phone, person.email].filter(Boolean).join(" · ")}</p>
        </div>
        <Button variant="ghost" onClick={() => setOpen((current) => !current)}>
          {open ? "Sluit" : "Wijzig"}
        </Button>
      </div>
      {open ? (
        <div className="grid gap-3 border-t border-line pt-3">
          <PersonFields
            name={name}
            phone={phone}
            email={email}
            kind={kind}
            company={company}
            notes={notes}
            onName={setName}
            onPhone={setPhone}
            onEmail={setEmail}
            onKind={setKind}
            onCompany={setCompany}
            onNotes={setNotes}
          />
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
          <Button disabled={pending} onClick={() => void save()}>
            {pending ? "Opslaan…" : "Persoon opslaan"}
          </Button>
        </div>
      ) : null}
    </li>
  );
}

function PersonFields({
  name,
  phone,
  email,
  kind,
  company,
  notes,
  onName,
  onPhone,
  onEmail,
  onKind,
  onCompany,
  onNotes,
}: {
  name: string;
  phone: string;
  email: string;
  kind: CrewKind;
  company: string;
  notes: string;
  onName: (value: string) => void;
  onPhone: (value: string) => void;
  onEmail: (value: string) => void;
  onKind: (value: CrewKind) => void;
  onCompany: (value: string) => void;
  onNotes: (value: string) => void;
}) {
  return (
    <>
      <Field label="Naam">
        <Input value={name} onChange={(event) => onName(event.target.value)} required />
      </Field>
      <Field label="Telefoon">
        <Input value={phone} onChange={(event) => onPhone(event.target.value)} />
      </Field>
      <Field label="E-mail">
        <Input value={email} onChange={(event) => onEmail(event.target.value)} />
      </Field>
      <Field label="Soort">
        <Select value={kind} onChange={(event) => onKind(event.target.value as CrewKind)}>
          {crewKinds.map((option) => (
            <option key={option} value={option}>
              {crewKindLabel[option]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Bedrijf" hint="Bij een freelancer, het bureau.">
        <Input value={company} onChange={(event) => onCompany(event.target.value)} />
      </Field>
      <Field label="Notitie">
        <Input value={notes} onChange={(event) => onNotes(event.target.value)} />
      </Field>
    </>
  );
}
