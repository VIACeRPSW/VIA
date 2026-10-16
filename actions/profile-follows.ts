"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { followChangedSchema, followInputSchema, type FollowActionResult, type FollowViewerResult } from "@/lib/profiles/follow-contract";
import { getProfileFollows } from "@/lib/profiles/read-follows.server";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function loadProfileFollows(input: unknown): Promise<FollowViewerResult> {
  try {
    const { isAuthenticated, userId } = await auth();
    const result = await getProfileFollows(input, isAuthenticated);
    if (result.status === "ready" && ((isAuthenticated && (!userId || result.summary.viewer === "anonymous"))
      || (!isAuthenticated && result.summary.viewer !== "anonymous"))) {
      throw new Error("InvalidFollowViewer");
    }
    return { ...result, actorKey: isAuthenticated ? userId : null };
  } catch (error) {
    console.error("Follow viewer read failed", getSafeCaughtErrorContext(error));
    return { status: "unavailable", actorKey: null };
  }
}

export async function setProfileFollow(input: unknown): Promise<FollowActionResult> {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) return { status: "unauthorized", message: "Vuelve a iniciar sesión para seguir autores." };
    const parsed = followInputSchema.safeParse(input);
    if (!parsed.success) return { status: "invalid", message: "La solicitud de seguimiento no es válida." };
    const profile = await getOwnProfile();
    if (profile.status === "missing") return { status: "profile-required", message: "Completa tu perfil antes de seguir autores." };
    if (profile.status !== "found" || profile.profile.clerkUserId !== userId) {
      return { status: profile.status === "unauthorized" ? "unauthorized" : "error",
        message: "No pudimos verificar tu perfil. Inténtalo de nuevo." };
    }
    if (profile.profile.id === parsed.data.profileId) return { status: "invalid", message: "No puedes seguirte a ti mismo." };
    const client = await createServerSupabaseClient();
    const result = await client.rpc("set_profile_follow", {
      p_profile_id: parsed.data.profileId, p_following: parsed.data.following,
    });
    if (result.error) {
      console.error("Profile follow mutation failed", { code: result.error.code });
      return { status: result.error.code === "42501" ? "unauthorized" : result.error.code === "P0002" ? "missing" : "error",
        message: result.error.code === "P0002" ? "Este perfil ya no está disponible."
          : result.error.code === "42501" ? "Tu sesión no permite este cambio. Vuelve a iniciar sesión."
            : "No pudimos confirmar el cambio. Reintenta para confirmar el mismo estado." };
    }
    const changed = followChangedSchema.parse(result.data);
    if (changed.summary.profile_id !== parsed.data.profileId || changed.summary.viewer !== "ready"
      || changed.summary.following !== parsed.data.following) throw new Error("InvalidFollowConfirmation");
    revalidatePath("/perfil");
    revalidatePath(`/usuario/${changed.actor_username}`);
    revalidatePath(`/usuario/${changed.summary.username}`);
    return { status: "success", summary: changed.summary };
  } catch (error) {
    console.error("Profile follow could not complete", getSafeCaughtErrorContext(error));
    return { status: "error", message: "No pudimos confirmar el cambio. Reintenta para confirmar el mismo estado." };
  }
}
