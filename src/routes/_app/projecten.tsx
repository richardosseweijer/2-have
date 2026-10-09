import { createFileRoute } from "@tanstack/react-router";
import { ProjectenPage } from "@/modules/projects/components/projecten-page";

export const Route = createFileRoute("/_app/projecten")({
  component: ProjectenPage,
});
