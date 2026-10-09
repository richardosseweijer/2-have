import { createFileRoute } from "@tanstack/react-router";
import { OffertesPage } from "@/modules/quotes/components/offertes-page";
import { listQuotesAction } from "@/modules/quotes/actions";

export const Route = createFileRoute("/_app/offertes/")({
  loader: () => listQuotesAction(),
  component: function OffertesRoute() {
    return <OffertesPage quotes={Route.useLoaderData()} />;
  },
});
