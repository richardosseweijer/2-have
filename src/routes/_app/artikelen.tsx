import { createFileRoute } from "@tanstack/react-router";
import { ArtikelenPage } from "@/modules/articles/components/artikelen-page";
import { listArticlesAction } from "@/modules/articles/actions";

export const Route = createFileRoute("/_app/artikelen")({
  loader: () => listArticlesAction(),
  component: function ArtikelenRoute() {
    return <ArtikelenPage articles={Route.useLoaderData()} />;
  },
});
