"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  likeBatchSchema, likeInputSchema, postLikeSchema,
  type LikeActionResult, type LikeReadResult,
} from "@/lib/posts/like-contract";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";
import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function loadPostLikes(postIds: string[]): Promise<LikeReadResult> {
  const parsed = likeBatchSchema.safeParse(postIds);
  if (!parsed.success) {
    console.error("Invalid post likes batch");
    return { status: "unavailable" };
  }
  try {
    const session = await auth();
    const client = session.isAuthenticated
      ? await createServerSupabaseClient() : createPublicSupabaseClient();
    const result = await client.rpc("get_post_likes", { p_post_ids: parsed.data });
    if (result.error) {
      console.error("Post likes read failed", { code: result.error.code });
      return { status: "unavailable" };
    }
    const likes = z.array(postLikeSchema).max(12).parse(result.data);
    if (new Set(likes.map((row) => row.post_id)).size !== likes.length
      || likes.some((row) => !parsed.data.includes(row.post_id))) {
      throw new Error("InvalidPostLikesProjection");
    }
    return { status: "ready", likes };
  } catch (error) {
    console.error("Post likes unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}

export async function setPostLike(input: unknown): Promise<LikeActionResult> {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return { status: "unauthorized", message: "Vuelve a iniciar sesión para dar me gusta." };
    }
    const parsed = likeInputSchema.safeParse(input);
    if (!parsed.success) return { status: "error", message: "La solicitud de me gusta no es válida." };
    const profile = await getOwnProfile();
    if (profile.status !== "found" || profile.profile.clerkUserId !== userId) {
      return { status: profile.status === "unauthorized" ? "unauthorized" : "error",
        message: "No pudimos verificar tu perfil. Abre tu perfil antes de dar me gusta." };
    }
    const client = await createServerSupabaseClient();
    const result = await client.rpc("set_post_like", {
      p_post_id: parsed.data.postId, p_liked: parsed.data.liked,
    });
    if (result.error) {
      console.error("Post like mutation failed", { code: result.error.code });
      return { status: result.error.code === "42501" ? "unauthorized" : "error",
        message: result.error.code === "P0002" ? "La publicación ya no está disponible."
          : "No pudimos confirmar el cambio. Reintenta para confirmar el mismo estado." };
    }
    const [like] = z.array(postLikeSchema).length(1).parse(result.data);
    if (like.post_id !== parsed.data.postId || like.liked !== parsed.data.liked || !like.can_like) {
      throw new Error("InvalidPostLikeConfirmation");
    }
    revalidatePath("/inicio");
    revalidatePath(`/post/${parsed.data.postId}`);
    return { status: "success", like };
  } catch (error) {
    console.error("Post like could not complete", getSafeCaughtErrorContext(error));
    return { status: "error", message: "No pudimos confirmar el cambio. Reintenta para confirmar el mismo estado." };
  }
}
