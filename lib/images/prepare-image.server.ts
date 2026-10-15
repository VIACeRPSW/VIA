import "server-only";
import sharp from "sharp";
import { IMAGE_MAX_DIMENSION, IMAGE_MIME_TYPES } from "@/lib/images/image-contract";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function prepareImage(file: File, options: {
  maxBytes: number;
  outputDimension: number;
  tooLargeMessage: string;
  processedTooLargeMessage: string;
  logMessage: string;
}): Promise<{ success: true; buffer: Buffer } | { success: false; message: string }> {
  if (!file.size) return { success: false, message: "Selecciona una imagen que no esté vacía." };
  if (file.size > options.maxBytes) return { success: false, message: options.tooLargeMessage };
  if (!IMAGE_MIME_TYPES.includes(file.type)) {
    return { success: false, message: "Usa una imagen JPEG, PNG o WebP." };
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const image = sharp(bytes, { limitInputPixels: IMAGE_MAX_DIMENSION ** 2, failOn: "warning" });
    const metadata = await image.metadata();
    const mime = metadata.format === "jpeg" ? "image/jpeg"
      : metadata.format === "png" ? "image/png"
      : metadata.format === "webp" ? "image/webp" : null;
    if (mime !== file.type) return { success: false, message: "El contenido de la imagen no coincide con su formato." };
    if (!metadata.width || !metadata.height || metadata.width > IMAGE_MAX_DIMENSION
      || metadata.height > IMAGE_MAX_DIMENSION || (metadata.pages ?? 1) > 1) {
      return { success: false, message: "Usa una imagen estática de hasta 4096 píxeles por lado." };
    }
    const buffer = await image.rotate()
      .resize(options.outputDimension, options.outputDimension, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: 80 }).toBuffer();
    if (buffer.length > options.maxBytes) return { success: false, message: options.processedTooLargeMessage };
    return { success: true, buffer };
  } catch (error) {
    console.error(options.logMessage, getSafeCaughtErrorContext(error));
    return { success: false, message: "No pudimos leer esa imagen. Selecciona un archivo válido." };
  }
}
