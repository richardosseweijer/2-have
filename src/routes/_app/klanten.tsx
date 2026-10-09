import { createFileRoute } from "@tanstack/react-router";
import { KlantenPage } from "@/modules/customers/components/klanten-page";
import { listCustomersAction } from "@/modules/customers/actions";

export const Route = createFileRoute("/_app/klanten")({
  loader: () => listCustomersAction(),
  component: function KlantenRoute() {
    const customers = Route.useLoaderData();
    return <KlantenPage customers={customers} />;
  },
});
