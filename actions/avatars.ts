"use server";

import { randomUUID } from "node:crypto";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { prepareAvatar } from "@/lib/profiles/avatar-image.server";
import { changeAvatar, type AvatarActionState } from "@/lib/profiles/avatar-operation";
import { avatarFolder, avatarRepository } from "@/lib/profiles/avatar-repository.server";
import { ownedAvatarPath } from "@/lib/profiles/avatar-path";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function avatarAction(
  _previousState: AvatarActionState,
  formData: FormData,
): Promise<AvatarActionState> {
  const { isAuthenticated, userId } = await auth();
  if (!isAuthenticated || !userId) {
    return { status: "unauthorized", message: "Vuelve a iniciar sesión para cambiar tu avatar." };
  }
  const operation = formData.get("operation");
  if (operation !== "upload" && operation !== "remove" && operation !== "cleanup") {
    return { status: "error", message: "La operación de avatar no es válida." };
  }
  const profile = await getOwnProfile();
  if (profile.status === "unauthorized") {
    return { status: "unauthorized", message: "Vuelve a iniciar sesión para cambiar tu avatar." };
  }
  if (profile.status !== "found") {
    return { status: "error", message: "No pudimos cargar tu perfil. Recárgalo antes de cambiar el avatar." };
  }
  try {
    const client = await createServerSupabaseClient();
    const repository = avatarRepository(client, userId);
    if (operation === "cleanup") {
      const clean = await repository.cleanup();
      revalidatePath("/perfil/editar");
      return {
        status: clean ? "success" : "warning",
        cleanupPending: !clean,
        message: clean ? "Limpieza completada."
          : "Hay limpieza pendiente o una carga en curso. Reintenta en unos minutos.",
      };
    }
    const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!origin) throw new Error("AvatarConfigurationError");
    const folder = avatarFolder(userId);
    ownedAvatarPath(profile.profile.avatarUrl, origin, folder);
    let upload: { path: string; url: string; buffer: Buffer } | null = null;
    if (operation === "upload") {
      const file = formData.get("avatar");
      if (!(file instanceof File)) return { status: "error", message: "Selecciona una imagen para tu avatar." };
      const prepared = await prepareAvatar(file);
      if (!prepared.success) return { status: "error", message: prepared.message };
      const path = `${folder}/${randomUUID()}.webp`;
      upload = { path, buffer: prepared.buffer, url: client.storage.from("avatars").getPublicUrl(path).data.publicUrl };
    }
    const result = await changeAvatar(repository, profile.profile.avatarUrl, upload);
    revalidatePath("/perfil");
    revalidatePath("/perfil/editar");
    revalidatePath(`/usuario/${profile.profile.username}`);
    return result;
  } catch (error) {
    console.error("Avatar action could not complete", getSafeCaughtErrorContext(error));
    return {
      status: "error", message: "No pudimos procesar el avatar. Recarga el perfil y reintenta.",
      cleanupPending: true,
    };
  }
}
