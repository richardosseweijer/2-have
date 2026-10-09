import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/dashboard";
import { listArticlesAction } from "@/modules/articles/actions";
import { listCustomersAction } from "@/modules/customers/actions";
import { listOrdersAction } from "@/modules/orders/actions";
import { listQuotesAction } from "@/modules/quotes/actions";

export const Route = createFileRoute("/_app/")({
  loader: async () => {
    const [customers, articles, quotes, orders] = await Promise.all([
      listCustomersAction(),
      listArticlesAction(),
      listQuotesAction(),
      listOrdersAction(),
    ]);
    return { customers, articles, quotes, orders };
  },
  component: Home,
});

function Home() {
  const { org } = Route.useRouteContext();
  const data = Route.useLoaderData();
  return (
    <Dashboard
      orgName={org.name}
      customerCount={data.customers.length}
      articleCount={data.articles.length}
      quotes={data.quotes}
      orders={data.orders}
    />
  );
}
