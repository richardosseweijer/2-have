import { createFileRoute, Link } from "@tanstack/react-router";
import { OfferteForm } from "@/modules/quotes/components/offerte-form";
import { listArticlesAction } from "@/modules/articles/actions";
import { listCustomersAction } from "@/modules/customers/actions";

export const Route = createFileRoute("/_app/offertes/new")({
  loader: async () => {
    const [customers, articles] = await Promise.all([listCustomersAction(), listArticlesAction()]);
    return { customers, articles };
  },
  component: NieuweOfferte,
});

function NieuweOfferte() {
  const data = Route.useLoaderData();
  const { org } = Route.useRouteContext();
  return (
    <div className="grid gap-5">
      <header>
        <Link to="/offertes" className="text-sm text-muted">
          Terug naar offertes
        </Link>
        <h1 className="font-display text-4xl tracking-tight">Nieuwe offerte</h1>
        <p className="mt-1 text-muted">Twee regels is een goed begin. De prijs mag je overschrijven.</p>
      </header>
      {data.customers.length === 0 ? (
        <p className="text-muted">
          Maak eerst een klant.{" "}
          <Link to="/klanten" className="font-semibold text-navy">
            Naar klanten
          </Link>
        </p>
      ) : (
        <OfferteForm
          customers={data.customers}
          articles={data.articles}
          defaultMarkupBps={org.defaultMarkupBps}
        />
      )}
    </div>
  );
}
