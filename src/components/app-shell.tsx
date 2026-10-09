import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { Logo } from "@/components/logo";
import { moduleNav } from "@/modules/registry";

export function AppShell({ orgName, children }: { orgName: string; children: ReactNode }) {
  return (
    <div className="min-h-screen md:grid md:grid-cols-[15.5rem_minmax(0,1fr)]">
      <aside className="flex flex-col border-b border-line bg-card md:min-h-screen md:border-r md:border-b-0">
        <div className="flex items-center justify-between px-4 py-4 md:block md:px-5 md:pt-6">
          <Link to="/" className="flex items-center gap-2.5">
            <Logo className="h-10 w-10" />
            <span className="font-display text-xl leading-none tracking-tight text-ink">2-have</span>
          </Link>
          <p className="mt-1 hidden text-sm text-muted md:block">{orgName}</p>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:grid md:px-3 md:pb-6">
          <NavLink to="/" label="Overzicht" exact />
          {moduleNav.map((item) => (
            <NavLink key={item.id} to={item.href} label={item.label} later={item.later} />
          ))}
        </nav>
        <p className="mt-auto hidden px-5 pb-6 text-sm text-muted md:block">2-have.eu</p>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 px-4 py-3 md:justify-end md:px-8">
          <p className="truncate text-sm text-muted md:hidden">{orgName}</p>
          <UserButton />
        </header>
        <main className="mx-auto w-full max-w-5xl px-4 pb-16 md:px-8">{children}</main>
      </div>
    </div>
  );
}

function NavLink({
  to,
  label,
  later = false,
  exact = false,
}: {
  to: "/" | "/klanten" | "/artikelen" | "/offertes" | "/bestellingen" | "/projecten" | "/planning";
  label: string;
  later?: boolean;
  exact?: boolean;
}) {
  return (
    <Link
      to={to}
      activeOptions={{ exact }}
      className="flex h-11 shrink-0 items-center gap-2 rounded-control px-3 text-sm font-medium text-muted hover:bg-paper hover:text-ink"
      activeProps={{
        className:
          "flex h-11 shrink-0 items-center gap-2 rounded-control bg-paper px-3 text-sm font-semibold text-ink",
      }}
    >
      <span>{label}</span>
      {later ? (
        <span className="rounded-full border border-line px-1.5 py-0.5 text-xs font-semibold text-muted">
          Later
        </span>
      ) : null}
    </Link>
  );
}
