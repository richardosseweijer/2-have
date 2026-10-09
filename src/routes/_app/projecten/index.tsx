import { createFileRoute } from "@tanstack/react-router";
import { ProjectenPage } from "@/modules/projects/components/projecten-page";
import { listProjectsAction } from "@/modules/projects/actions";
import { listCustomersAction } from "@/modules/customers/actions";

export const Route = createFileRoute("/_app/projecten/")({
  loader: async () => {
    const [projects, customers] = await Promise.all([listProjectsAction(), listCustomersAction()]);
    return { projects, customers };
  },
  component: function ProjectenRoute() {
    const data = Route.useLoaderData();
    return <ProjectenPage projects={data.projects} customers={data.customers} />;
  },
});
