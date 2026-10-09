import { createFileRoute, notFound } from "@tanstack/react-router";
import { InkoopDetailPage } from "@/modules/purchases/components/inkoop-detail";
import { getPurchaseAction } from "@/modules/purchases/actions";
import { listArticlesAction } from "@/modules/articles/actions";

export const Route = createFileRoute("/_app/inkoop/$id")({
  loader: async ({ params }) => {
    const [purchase, articles] = await Promise.all([
      getPurchaseAction({ data: { id: params.id } }),
      listArticlesAction(),
    ]);
    if (!purchase) throw notFound();
    return { purchase, articles };
  },
  component: function InkoopDetailRoute() {
    const data = Route.useLoaderData();
    return <InkoopDetailPage purchase={data.purchase} articles={data.articles} />;
  },
});
