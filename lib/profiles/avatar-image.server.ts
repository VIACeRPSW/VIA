import "server-only";
import { AVATAR_MAX_BYTES } from "@/lib/profiles/avatar-path";
import { prepareImage } from "@/lib/images/prepare-image.server";

export async function prepareAvatar(file: File): Promise<
  { success: true; buffer: Buffer } | { success: false; message: string }
> {
  return prepareImage(file, {
    maxBytes: AVATAR_MAX_BYTES, outputDimension: 512,
    tooLargeMessage: "El avatar debe pesar como máximo 2 MiB.",
    processedTooLargeMessage: "El avatar procesado supera el límite de 2 MiB.",
    logMessage: "Avatar image could not be decoded",
  });
}
