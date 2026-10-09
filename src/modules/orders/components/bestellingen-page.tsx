import { Link } from "@tanstack/react-router";
import { Panel, StatusPill } from "@/components/ui";
import { formatEur } from "@/lib/money";
import { orderStatusLabel } from "../labels";
import type { OrderSummary } from "../boundary";

const tone = {
  confirmed: "ok",
  in_progress: "warn",
  done: "neutral",
  cancelled: "bad",
} as const;

export function BestellingenPage({ orders }: { orders: OrderSummary[] }) {
  return (
    <div className="grid gap-6">
      <header>
        <h1 className="font-display text-4xl tracking-tight">Bestellingen</h1>
        <p className="mt-1 text-muted">Alleen lezen. Een bestelling ontstaat als je een offerte accepteert.</p>
      </header>
      <Panel className="p-0">
        {orders.length === 0 ? (
          <p className="p-5 text-muted">Nog geen bestellingen.</p>
        ) : (
          <ul>
            {orders.map((order) => (
              <li key={order.id} className="border-b border-line last:border-b-0">
                <Link
                  to="/bestellingen/$id"
                  params={{ id: order.id }}
                  className="grid gap-1 px-4 py-3 hover:bg-paper md:grid-cols-[8rem_minmax(0,1fr)_auto_auto] md:items-center md:gap-4 md:px-5"
                >
                  <span className="font-semibold tabular-nums">{order.number}</span>
                  <span>
                    {order.customerName}
                    {order.quoteNumber ? <span className="text-muted"> · {order.quoteNumber}</span> : null}
                  </span>
                  <StatusPill tone={tone[order.status]}>{orderStatusLabel[order.status]}</StatusPill>
                  <span className="tabular-nums md:text-right">{formatEur(order.totalCents)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
