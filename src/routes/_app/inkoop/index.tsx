import { createFileRoute } from "@tanstack/react-router";
import { InkoopPage } from "@/modules/purchases/components/inkoop-page";
import { listPurchasingAction } from "@/modules/purchases/actions";

export const Route = createFileRoute("/_app/inkoop/")({
  loader: () => listPurchasingAction(),
  component: function InkoopRoute() {
    return <InkoopPage board={Route.useLoaderData()} />;
  },
});
