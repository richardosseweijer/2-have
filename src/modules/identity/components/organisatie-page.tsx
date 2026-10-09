import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { Logo } from "@/components/logo";
import { Button, ErrorNote, Field, Input, Panel } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { createOrgAction } from "../actions";

export function OrganisatiePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setError("Vul een organisatienaam in.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await createOrgAction({ data: { name } });
      await router.navigate({ to: "/" });
    } catch (caught) {
      setError(errorText(caught));
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center px-4 py-12">
      <div className="mb-6 flex items-center justify-between">
        <span className="flex items-center gap-2.5">
          <Logo className="h-10 w-10" />
          <span className="font-display text-3xl">2-have</span>
        </span>
        <UserButton />
      </div>
      <Panel>
        <h1 className="font-display text-4xl tracking-tight">Jouw organisatie</h1>
        <p className="mt-2 text-muted">
          De eerste gebruiker maakt de organisatie aan en wordt eigenaar. Iedereen hoort bij precies één organisatie.
        </p>
        <form className="mt-5 grid gap-3" onSubmit={onSubmit}>
          <Field label="Naam">
            <Input value={name} onChange={(event) => setName(event.target.value)} required />
          </Field>
          {error ? <ErrorNote>{error}</ErrorNote> : null}
          <Button type="submit" disabled={pending}>
            {pending ? "Opslaan…" : "Organisatie aanmaken"}
          </Button>
        </form>
      </Panel>
    </main>
  );
}
