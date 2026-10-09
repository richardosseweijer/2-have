import { useState, type FormEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { authClient, GROK_PROVIDERS, signIn } from "@/lib/auth/client";
import { Logo } from "@/components/logo";
import { Button, ErrorNote, Field, Input } from "@/components/ui";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [mode, setMode] = useState<"in" | "up">("up");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      if (mode === "up") {
        if (name.trim().length < 1) throw new Error("Vul je naam in.");
        const result = await authClient.signUp.email({
          name: name.trim(),
          email: email.trim(),
          password,
          callbackURL: "/organisatie",
        });
        if (result.error) throw new Error(result.error.message ?? "Account aanmaken mislukt.");
      } else {
        const result = await authClient.signIn.email({
          email: email.trim(),
          password,
          callbackURL: "/",
        });
        if (result.error) throw new Error(result.error.message ?? "Inloggen mislukt.");
      }
      window.location.href = mode === "up" ? "/organisatie" : "/";
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Er ging iets mis.");
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen md:grid-cols-2">
      <section className="hidden flex-col justify-center gap-8 bg-navy px-10 py-12 text-paper-2 md:flex">
        <div className="w-fit rounded-card bg-paper-2 p-3">
          <Logo className="h-24 w-24" />
        </div>
        <h1 className="font-display text-5xl leading-tight tracking-tight">2-have home</h1>
      </section>
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <p className="font-display text-3xl md:hidden">2-have home</p>
          <h2 className="mt-2 font-display text-4xl tracking-tight">
            {mode === "up" ? "Account maken" : "Inloggen"}
          </h2>
          <form className="mt-6 grid gap-3" onSubmit={onSubmit}>
            {mode === "up" ? (
              <Field label="Naam">
                <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
              </Field>
            ) : null}
            <Field label="E-mail">
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </Field>
            <Field label="Wachtwoord">
              <Input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={mode === "up" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </Field>
            {error ? <ErrorNote>{error}</ErrorNote> : null}
            <Button type="submit" disabled={pending}>
              {pending ? "Bezig…" : mode === "up" ? "Account maken" : "Inloggen"}
            </Button>
          </form>
          <button
            type="button"
            className="mt-4 text-sm text-muted underline-offset-4 hover:underline"
            onClick={() => {
              setMode((current) => (current === "up" ? "in" : "up"));
              setError(null);
            }}
          >
            {mode === "up" ? "Ik heb al een account" : "Nieuw account maken"}
          </button>
          <div className="mt-8 grid gap-2">
            {GROK_PROVIDERS.map((provider) => (
              <Button
                key={provider.providerId}
                variant="ghost"
                onClick={() => void signIn(provider.providerId, { callbackURL: "/" })}
              >
                Doorgaan met {provider.label}
              </Button>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
