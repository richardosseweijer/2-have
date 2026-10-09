import { createFileRoute, notFound } from "@tanstack/react-router";
import { OfferteDetail } from "@/modules/quotes/components/offerte-detail";
import { getQuoteAction } from "@/modules/quotes/actions";

export const Route = createFileRoute("/_app/offertes/$id")({
  loader: async ({ params }) => {
    const quote = await getQuoteAction({ data: { id: params.id } });
    if (!quote) throw notFound();
    return quote;
  },
  component: function OfferteRoute() {
    return <OfferteDetail quote={Route.useLoaderData()} />;
  },
});
