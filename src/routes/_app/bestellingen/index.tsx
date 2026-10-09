import { createFileRoute } from "@tanstack/react-router";
import { BestellingenPage } from "@/modules/orders/components/bestellingen-page";
import { listOrdersAction } from "@/modules/orders/actions";

export const Route = createFileRoute("/_app/bestellingen/")({
  loader: () => listOrdersAction(),
  component: function BestellingenRoute() {
    return <BestellingenPage orders={Route.useLoaderData()} />;
  },
});
