import { createFileRoute, notFound } from "@tanstack/react-router";
import { BestellingDetail } from "@/modules/orders/components/bestelling-detail";
import { getOrderAction } from "@/modules/orders/actions";

export const Route = createFileRoute("/_app/bestellingen/$id")({
  loader: async ({ params }) => {
    const order = await getOrderAction({ data: { id: params.id } });
    if (!order) throw notFound();
    return order;
  },
  component: function BestellingRoute() {
    return <BestellingDetail order={Route.useLoaderData()} />;
  },
});
