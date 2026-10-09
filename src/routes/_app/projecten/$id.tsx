import { createFileRoute, notFound } from "@tanstack/react-router";
import { ProjectDetailPage } from "@/modules/projects/components/project-detail";
import { getProjectAction } from "@/modules/projects/actions";
import { listArticlesAction } from "@/modules/articles/actions";

export const Route = createFileRoute("/_app/projecten/$id")({
  loader: async ({ params }) => {
    const [project, articles] = await Promise.all([
      getProjectAction({ data: { id: params.id } }),
      listArticlesAction(),
    ]);
    if (!project) throw notFound();
    return { project, articles };
  },
  component: function ProjectRoute() {
    const data = Route.useLoaderData();
    return <ProjectDetailPage project={data.project} articles={data.articles} />;
  },
});
