import "server-only";
import { prepareImage } from "@/lib/images/prepare-image.server";
import { POST_MAX_BYTES } from "@/lib/posts/post-contract";
export function preparePostImage(file: File) {
  return prepareImage(file, {
    maxBytes: POST_MAX_BYTES, outputDimension: 4096,
    tooLargeMessage: "La imagen debe pesar como máximo 5 MiB.",
    processedTooLargeMessage: "La imagen procesada supera el límite de 5 MiB.",
    logMessage: "Post image could not be decoded",
  });
}
