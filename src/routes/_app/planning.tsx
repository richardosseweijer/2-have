import { createFileRoute } from "@tanstack/react-router";
import { PlanningPage } from "@/modules/planning/components/planning-page";
import { listPlanningAction } from "@/modules/planning/actions";

export const Route = createFileRoute("/_app/planning")({
  loader: () => listPlanningAction(),
  component: function PlanningRoute() {
    return <PlanningPage board={Route.useLoaderData()} />;
  },
});
