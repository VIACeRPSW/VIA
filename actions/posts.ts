"use server";

import { createHash, randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { postInputSchema, postLocatorSchema, type PostActionState, type PostField } from "@/lib/posts/post-contract";
import { preparePostImage } from "@/lib/posts/post-image.server";
import { postRepository } from "@/lib/posts/post-repository.server";
import { publishPost } from "@/lib/posts/publish-post";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

function refreshPostViews(postId: string, username: string) {
  revalidatePath(`/post/${postId}`);
  revalidatePath(`/post/${postId}/editar`);
  revalidatePath("/perfil");
  revalidatePath("/inicio");
  revalidatePath("/imagenes");
  revalidatePath(`/usuario/${username}`);
}

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
      refreshPostViews(result.postId, profile.profile.username);
    }

    return result;
  } catch (error) {
    console.error("Post action could not complete", getSafeCaughtErrorContext(error));
    return { status: "error", message: "No pudimos conectar con publicaciones. Inténtalo de nuevo.", cleanupPending: true };
  }
}

export async function updatePostAction(
  _previous: PostActionState, formData: FormData,
): Promise<PostActionState> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return { status: "unauthorized", message: "Vuelve a iniciar sesión para editar." };
  const profile = await getOwnProfile();
  if (profile.status !== "found" || profile.profile.clerkUserId !== userId) {
    return { status: "error", message: "No pudimos verificar tu perfil. Vuelve a intentarlo." };
  }
  const locator = postLocatorSchema.safeParse({ postId: formData.get("postId"), version: formData.get("version") });
  const input = postInputSchema.safeParse(Object.fromEntries(
    ["operationId", "title", "description", "categoryId", "hashtags"].map((key) => [key, formData.get(key)]),
  ));
  if (!locator.success || !input.success) {
    return { status: "invalid", message: "Revisa título, categoría y hashtags; si la edición caducó, recarga la página." };
  }
  const { postId, version } = locator.data;
  try {
    const client = await createServerSupabaseClient();
    const own = await client.from("posts").select("id,version").eq("id", postId).maybeSingle();
    if (own.error) throw new Error("OwnPostQueryError");
    if (!own.data) return { status: "error", message: "La publicación no existe o no te pertenece." };
    const file = formData.get("image");
    const repository = postRepository(client, userId);
    let result: PostActionState;
    if (file instanceof File && (file.size > 0 || file.name !== "")) {
      let versionConflict = false;
      const prepared = await preparePostImage(file);
      if (!prepared.success) return { status: "invalid", message: prepared.message, fieldErrors: { image: prepared.message } };
      result = await publishPost(input.data, prepared.buffer,
        createHash("sha256").update(prepared.buffer).digest("hex"), randomUUID(), {
        ...repository,
        async commit(operation, lease) {
          const committed = await client.rpc("commit_post_image_replacement", {
            p_post_id: postId, p_version: version, p_operation_id: operation, p_lease_id: lease,
          });
          if (committed.error) {
            versionConflict = committed.error.code === "40001";
            console.error("Post replacement failed", { code: committed.error.code });
            throw new Error("PostReplacementError");
          }
          return z.uuid().parse(committed.data);
        },
        async begin(data, digest, lease) {
          const planned = await repository.begin(data, digest, lease);
          if (planned.status === "published" && planned.post_id !== postId) {
            return { status: "conflict" };
          }
          return planned;
        },
      });
      if (versionConflict && result.status !== "success") return {
        status: "conflict", cleanupPending: result.cleanupPending,
        message: "Este post cambió en otra pestaña. El original se conserva; recarga antes de reemplazar su imagen.",
      };
    } else {
      if (own.data.version !== version) {
        return { status: "conflict", message: "Este post cambió en otra pestaña. Recarga antes de editar para no perder cambios." };
      }
      const updated = await client.from("posts").update({
        title: input.data.title, description: input.data.description,
        category_id: input.data.categoryId, hashtags: input.data.hashtags,
      }).eq("id", postId).eq("version", version).select("id").maybeSingle();
      if (updated.error) {
        console.error("Post metadata update failed", { code: updated.error.code });
        return { status: "error", message: "No pudimos guardar los cambios. Comprueba la categoría e inténtalo de nuevo." };
      }
      if (!updated.data) return { status: "conflict", message: "El post cambió o fue eliminado. Recarga antes de continuar." };
      result = { status: "success", postId };
    }
    if (result.status === "success") {
      refreshPostViews(postId, profile.profile.username);
      try {
        const clean = await repository.cleanup();
        return { ...result, cleanupPending: !clean, message: clean ? "Publicación actualizada." : "Cambios guardados; quedan imágenes pendientes de limpieza." };
      } catch (error) {
        console.error("Updated post cleanup failed", getSafeCaughtErrorContext(error));
        return { ...result, cleanupPending: true, message: "Cambios guardados. No pudimos limpiar la imagen anterior; reintenta la limpieza." };
      }
    }
    return result;
  } catch (error) {
    console.error("Post update failed", getSafeCaughtErrorContext(error));
    return { status: "error", message: "No pudimos actualizar el post. El original se conserva; reintenta o recarga si cambió en otra pestaña.", cleanupPending: true };
  }
}

export async function deletePostAction(
  _previous: PostActionState, formData: FormData,
): Promise<PostActionState> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) return { status: "unauthorized", message: "Vuelve a iniciar sesión para eliminar." };
  const locator = postLocatorSchema.safeParse({ postId: formData.get("postId"), version: formData.get("version") });
  if (!locator.success || formData.get("confirmed") !== "yes") {
    return { status: "invalid", message: "Confirma la eliminación desde el detalle de tu publicación." };
  }
  const profile = await getOwnProfile();
  if (profile.status !== "found" || profile.profile.clerkUserId !== userId) {
    return { status: "error", message: "No pudimos verificar tu perfil." };
  }
  try {
    const client = await createServerSupabaseClient();
    const removed = await client.from("posts").delete()
      .eq("id", locator.data.postId).eq("version", locator.data.version).select("id");
    if (removed.error) throw new Error("PostDeleteQueryError");
    const rows = z.array(z.object({ id: z.uuid() })).parse(removed.data);
    if (rows.length === 0) {
      const current = await client.from("posts").select("id").eq("id", locator.data.postId).maybeSingle();
      if (current.error) throw new Error("PostDeleteVerificationError");
      if (current.data) return { status: "conflict", message: "La publicación cambió. Recarga antes de eliminarla." };
    }
    refreshPostViews(locator.data.postId, profile.profile.username);
    try {
      const clean = await postRepository(client, userId).cleanup();
      return {
        status: "deleted", cleanupPending: !clean,
        message: clean ? "La publicación ya no está disponible en tu cuenta." : "Publicación retirada. Queda limpieza pendiente; puedes reintentarla."
      };
    } catch (error) {
      console.error("Deleted post cleanup failed", getSafeCaughtErrorContext(error));
      return { status: "deleted", cleanupPending: true, message: "Publicación retirada. No pudimos limpiar su imagen; reintenta la limpieza." };
    }
  } catch (error) {
    console.error("Post deletion failed", getSafeCaughtErrorContext(error));
    return { status: "error", message: "No pudimos eliminar la publicación. Inténtalo de nuevo." };
  }
}
export async function deletePostAndRedirectAction(
  previous: PostActionState, formData: FormData,
): Promise<PostActionState> {
  const result = await deletePostAction(previous, formData);
  if (result.status === "deleted") {
    redirect(`/imagenes?retirado=1${result.cleanupPending ? "&limpieza=pendiente" : ""}`);
  }
  return result;
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
