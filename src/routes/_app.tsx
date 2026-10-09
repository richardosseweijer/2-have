import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { requireOrg } from "@/lib/org-gate";

export const Route = createFileRoute("/_app")({
  beforeLoad: () => requireOrg(),
  component: AppLayout,
});

function AppLayout() {
  const { org } = Route.useRouteContext();
  return (
    <AppShell orgName={org.name}>
      <Outlet />
    </AppShell>
  );
}
