import { useState, type FormEvent } from "react";
import { useRouter } from "@tanstack/react-router";
import { Button, ErrorNote, Field, Input } from "@/components/ui";
import { errorText } from "@/lib/errors";
import { bpsToInput, parsePercentToBps } from "@/lib/money";
import { setDefaultMarkupAction } from "../actions";

export function DefaultMarkupForm({ markupBps }: { markupBps: number }) {
  const router = useRouter();
  const [value, setValue] = useState(bpsToInput(markupBps));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const parsed = parsePercentToBps(value);
    if (parsed == null || parsed < 0) {
      setError("Vul een opslag in procenten in, bijvoorbeeld 35.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      await setDefaultMarkupAction({ data: { markupBps: parsed } });
      await router.invalidate();
    } catch (caught) {
      setError(errorText(caught));
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="mt-4 grid gap-3 sm:grid-cols-[16rem_auto] sm:items-end" onSubmit={onSubmit}>
      <Field label="Standaardopslag (%)" hint="Komt op een nieuwe offerte. Bestaande offertes blijven staan.">
        <Input inputMode="decimal" value={value} onChange={(event) => setValue(event.target.value)} />
      </Field>
      <Button type="submit" variant="ghost" disabled={pending}>
        {pending ? "Opslaan…" : "Opslag opslaan"}
      </Button>
      {error ? <div className="sm:col-span-2"><ErrorNote>{error}</ErrorNote></div> : null}
    </form>
  );
}
