import { isRedirect, redirect } from "@tanstack/react-router";
import { getCurrentOrgAction } from "@/modules/identity/actions";

function unauthorized(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message === "Unauthorized" || message.includes("Unauthorized");
}

export async function requireOrg() {
  try {
    const org = await getCurrentOrgAction();
    if (!org) throw redirect({ to: "/organisatie" });
    return { org };
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (unauthorized(error)) throw redirect({ to: "/login" });
    throw error;
  }
}

export async function requireSignedOutOfOrg() {
  try {
    const org = await getCurrentOrgAction();
    if (org) throw redirect({ to: "/" });
    return {};
  } catch (error) {
    if (isRedirect(error)) throw error;
    if (unauthorized(error)) throw redirect({ to: "/login" });
    throw error;
  }
}
