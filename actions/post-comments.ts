"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { commentCreatedSchema, commentInputSchema, type CommentActionResult, type CommentCursor } from "@/lib/posts/comment-contract";
import { getPublicComments } from "@/lib/posts/read-comments.server";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function loadPostComments(postId: string, cursor?: CommentCursor) {
  return getPublicComments(postId, cursor);
}

export async function createCommentAction(input: unknown): Promise<CommentActionResult> {
  try {
    const { isAuthenticated, userId } = await auth();
    if (!isAuthenticated || !userId) {
      return { status: "unauthorized", message: "Vuelve a iniciar sesión para comentar." };
    }
    const parsed = commentInputSchema.safeParse(input);
    if (!parsed.success) {
      return { status: "invalid", message: "Escribe de 1 a 1000 caracteres de texto válido. Si el envío caducó, recarga la página." };
    }
    const profile = await getOwnProfile();
    if (profile.status === "missing") {
      return { status: "profile-required", message: "Completa tu perfil antes de comentar." };
    }
    if (profile.status !== "found" || profile.profile.clerkUserId !== userId) {
      return { status: profile.status === "unauthorized" ? "unauthorized" : "error",
        message: "No pudimos verificar tu perfil. Inténtalo de nuevo." };
    }
    const client = await createServerSupabaseClient();
    const result = await client.rpc("create_post_comment", {
      p_post_id: parsed.data.postId, p_content: parsed.data.content, p_operation_id: parsed.data.operationId,
    });
    if (result.error) {
      console.error("Comment creation failed", { code: result.error.code });
      if (result.error.code === "23505") return { status: "conflict",
        message: "Este envío ya se usó con otro texto. Recarga y comprueba tus comentarios antes de enviar otro." };
      return { status: result.error.code === "42501" ? "unauthorized" : "error",
        message: result.error.code === "P0002" ? "La publicación ya no está disponible."
          : "No pudimos confirmar el comentario. Reintenta sin cambiar el texto para confirmar el mismo envío." };
    }
    const created = commentCreatedSchema.parse(result.data);
    if (created.comment.post_id !== parsed.data.postId || created.comment.content !== parsed.data.content
      || created.comment.author_username !== profile.profile.username) {
      throw new Error("InvalidCommentConfirmation");
    }
    revalidatePath("/inicio");
    revalidatePath(`/post/${parsed.data.postId}`);
    return { status: "success", ...created };
  } catch (error) {
    console.error("Comment creation unavailable", getSafeCaughtErrorContext(error));
    return { status: "error",
      message: "No pudimos confirmar el comentario. Reintenta sin cambiar el texto para confirmar el mismo envío." };
  }
}
