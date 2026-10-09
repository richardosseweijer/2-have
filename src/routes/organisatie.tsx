import { createFileRoute } from "@tanstack/react-router";
import { OrganisatiePage } from "@/modules/identity/components/organisatie-page";
import { requireSignedOutOfOrg } from "@/lib/org-gate";

export const Route = createFileRoute("/organisatie")({
  beforeLoad: () => requireSignedOutOfOrg(),
  component: OrganisatiePage,
});
