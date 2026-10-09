import { Link } from "@tanstack/react-router";
import { Panel, StatusPill } from "@/components/ui";
import { formatEur, formatQty } from "@/lib/money";
import { orderStatusLabel } from "../labels";
import type { OrderDetail } from "../boundary";

export function BestellingDetail({ order }: { order: OrderDetail }) {
  return (
    <div className="grid gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted">{order.createdOn}</p>
          <h1 className="font-display text-4xl tracking-tight">{order.number}</h1>
          <p className="mt-1 text-muted">{order.customerName}</p>
        </div>
        <StatusPill tone="ok">{orderStatusLabel[order.status]}</StatusPill>
      </header>
      {order.quoteNumber ? (
        <Link to="/offertes/$id" params={{ id: order.quoteId }} className="text-sm font-semibold text-navy">
          Offerte {order.quoteNumber}
        </Link>
      ) : null}
      <Panel className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line text-muted">
            <tr>
              <th className="px-4 py-2 font-medium md:px-5">Omschrijving</th>
              <th className="px-2 py-2 font-medium">Aantal</th>
              <th className="px-2 py-2 font-medium">Prijs</th>
              <th className="px-4 py-2 text-right font-medium md:px-5">Totaal</th>
            </tr>
          </thead>
          <tbody>
            {order.lines.map((line) => (
              <tr key={line.id} className="border-b border-line last:border-b-0">
                <td className="px-4 py-3 md:px-5">
                  <p className="font-medium">{line.description}</p>
                  <p className="text-muted">{line.unit}</p>
                </td>
                <td className="px-2 py-3 tabular-nums">{formatQty(line.qty)}</td>
                <td className="px-2 py-3 tabular-nums">{formatEur(line.unitPriceCents)}</td>
                <td className="px-4 py-3 text-right tabular-nums md:px-5">{formatEur(line.lineTotalCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 py-4 text-right text-lg font-semibold tabular-nums md:px-5">
          Totaal {formatEur(order.totalCents)}
        </p>
      </Panel>
      <p className="text-sm text-muted">
        De regels zijn gekopieerd bij het accepteren. De prijs op het artikel wijzigen verandert deze bestelling niet.
      </p>
    </div>
  );
}
