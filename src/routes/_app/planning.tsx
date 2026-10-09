import { createFileRoute } from "@tanstack/react-router";
import { PlanningPage } from "@/modules/planning/components/planning-page";

export const Route = createFileRoute("/_app/planning")({
  component: PlanningPage,
});
