import { createFileRoute } from "@tanstack/react-router";
import { CrewPage } from "@/modules/crew/components/crew-page";
import { listCrewAction } from "@/modules/crew/actions";

export const Route = createFileRoute("/_app/crew")({
  loader: () => listCrewAction(),
  component: function CrewRoute() {
    return <CrewPage crew={Route.useLoaderData()} />;
  },
});
