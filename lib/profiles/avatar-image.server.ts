import "server-only";
import sharp from "sharp";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/profiles/avatar-path";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function prepareAvatar(file: File): Promise<
  { success: true; buffer: Buffer } | { success: false; message: string }
> {
  if (!file.size) return { success: false, message: "Selecciona una imagen que no esté vacía." };
  if (file.size > AVATAR_MAX_BYTES) return { success: false, message: "El avatar debe pesar como máximo 2 MiB." };
  if (!AVATAR_MIME_TYPES.includes(file.type)) {
    return { success: false, message: "Usa una imagen JPEG, PNG o WebP." };
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { limitInputPixels: 4096 * 4096, failOn: "warning" });
    const metadata = await image.metadata();
    const mime = metadata.format === "jpeg" ? "image/jpeg"
      : metadata.format === "png" ? "image/png"
      : metadata.format === "webp" ? "image/webp" : null;
    if (mime !== file.type) {
      return { success: false, message: "El contenido de la imagen no coincide con su formato." };
    }
    if (!metadata.width || !metadata.height || metadata.width > 4096
      || metadata.height > 4096 || (metadata.pages ?? 1) > 1) {
      return { success: false, message: "Usa una imagen estática de hasta 4096 píxeles por lado." };
    }
    const buffer = await image.rotate()
      .resize(512, 512, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    if (buffer.length > AVATAR_MAX_BYTES) {
      return { success: false, message: "El avatar procesado supera el límite de 2 MiB." };
    }
    return { success: true, buffer };
  } catch (error) {
    console.error("Avatar image could not be decoded", getSafeCaughtErrorContext(error));
    return { success: false, message: "No pudimos leer esa imagen. Selecciona un archivo válido." };
  }
}
