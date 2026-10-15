"use server";

import { createHash, randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { postInputSchema, type PostActionState, type PostField } from "@/lib/posts/post-contract";
import { preparePostImage } from "@/lib/posts/post-image.server";
import { postRepository } from "@/lib/posts/post-repository.server";
import { publishPost } from "@/lib/posts/publish-post";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function createPostAction(
  _previousState: PostActionState, formData: FormData,
): Promise<PostActionState> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return { status: "unauthorized", message: "Vuelve a iniciar sesión para publicar." };
  const profile = await getOwnProfile();
  if (profile.status !== "found" || profile.profile.clerkUserId !== userId) {
    return { status: profile.status === "unauthorized" ? "unauthorized" : "error", message: "No pudimos cargar tu perfil. Vuelve a tu perfil antes de publicar." };
  }
  const parsed = postInputSchema.safeParse(Object.fromEntries(
    ["operationId", "title", "description", "categoryId", "hashtags"].map((key) => [key, formData.get(key)]),
  ));
  if (!parsed.success) {
    const fieldErrors: Partial<Record<PostField, string>> = {};
    for (const issue of parsed.error.issues) {
      const field = issue.path[0];
      if (field === "title" || field === "description" || field === "categoryId" || field === "hashtags") {
        fieldErrors[field] ??= field === "hashtags"
          ? "Escribe de 1 a 5 hashtags únicos, de 2 a 30 letras, números o guiones bajos."
          : issue.message;
      }
    }
    return { status: "invalid", message: "Revisa los campos. Si el formulario caducó, recárgalo.", fieldErrors };
  }
  const image = formData.get("image");
  if (!(image instanceof File)) {
    return { status: "invalid", message: "Selecciona una imagen.", fieldErrors: { image: "Selecciona una imagen." } };
  }
  const prepared = await preparePostImage(image);
  if (!prepared.success) {
    return { status: "invalid", message: prepared.message, fieldErrors: { image: prepared.message } };
  }
  try {
    const client = await createServerSupabaseClient();
    const result = await publishPost(parsed.data, prepared.buffer,
      createHash("sha256").update(prepared.buffer).digest("hex"), randomUUID(), postRepository(client, userId));
    if (result.status === "success" && result.postId) {
      revalidatePath(`/post/${result.postId}`);
      revalidatePath("/perfil");
    }
    return result;
  } catch (error) {
    console.error("Post action could not complete", getSafeCaughtErrorContext(error));
    return { status: "error", message: "No pudimos conectar con publicaciones. Inténtalo de nuevo.", cleanupPending: true };
  }
}

export async function cleanupPostUploadsAction(): Promise<PostActionState> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return { status: "unauthorized", message: "Vuelve a iniciar sesión." };
  try {
    const client = await createServerSupabaseClient();
    const clean = await postRepository(client, userId).cleanup();
    return {
      status: clean ? "idle" : "busy", cleanupPending: !clean,
      message: clean ? "Limpieza completada. Puedes volver a publicar."
        : "Hay una carga en curso. Reintenta la limpieza tras 10 minutos.",
    };
  } catch (error) {
    console.error("Post cleanup action failed", getSafeCaughtErrorContext(error));
    return { status: "error", message: "No pudimos completar la limpieza. Inténtalo de nuevo.", cleanupPending: true };
  }
}
