import "server-only";

import { redirect } from "next/navigation";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";

export async function getProfileForRoute(route: "existing" | "onboarding") {
  const result = await getOwnProfile();

  if (result.status === "unauthorized") redirect("/sign-in");
  if (result.status === "missing" && route === "existing") redirect("/perfil/completar");
  if (result.status === "found" && route === "onboarding") redirect("/perfil");

  return result;
}
