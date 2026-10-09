import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";
import { lateMaterials } from "@/lib/coverage";
import { listArticlesAction } from "@/modules/articles/actions";
import { listCustomersAction } from "@/modules/customers/actions";
import { listOrdersAction } from "@/modules/orders/actions";
import { listStaffingGapsAction } from "@/modules/planning/actions";
import { listIncomingAction } from "@/modules/purchases/actions";
import { listUpcomingNeedsAction } from "@/modules/projects/actions";
import { listQuotesAction } from "@/modules/quotes/actions";

export const Route = createFileRoute("/_app/")({
  loader: async () => {
    const [customers, articles, quotes, orders, needs, incoming, staffingGaps] = await Promise.all([
      listCustomersAction(),
      listArticlesAction(),
      listQuotesAction(),
      listOrdersAction(),
      listUpcomingNeedsAction(),
      listIncomingAction(),
      listStaffingGapsAction(),
    ]);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());
    return {
      customers,
      articles,
      quotes,
      orders,
      staffingGaps,
      lateMaterials: lateMaterials(
        needs,
        articles.map((article) => ({ articleId: article.id, onHand: article.onHand })),
        incoming,
        today,
      ),
    };
  },
  component: Home,
});

function Home() {
  const { org } = Route.useRouteContext();
  const data = Route.useLoaderData();
  return (
    <Dashboard
      orgName={org.name}
      defaultMarkupBps={org.defaultMarkupBps}
      customerCount={data.customers.length}
      articleCount={data.articles.length}
      quotes={data.quotes}
      orders={data.orders}
      lateMaterials={data.lateMaterials}
      staffingGaps={data.staffingGaps}
    />
  );
}