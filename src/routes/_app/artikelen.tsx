import { createFileRoute } from "@tanstack/react-router";
import { ArtikelenPage } from "@/modules/articles/components/artikelen-page";
import { listArticleCatalogAction } from "@/modules/articles/actions";

export const Route = createFileRoute("/_app/artikelen")({
  loader: () => listArticleCatalogAction(),
  component: function ArtikelenRoute() {
    const { articles, categories } = Route.useLoaderData();
    return <ArtikelenPage articles={articles} categories={categories} />;
  },
});
