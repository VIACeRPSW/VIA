export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export { IMAGE_MIME_TYPES as AVATAR_MIME_TYPES } from "@/lib/images/image-contract";
import { IMAGE_PATH_PATTERN as AVATAR_PATH_PATTERN } from "@/lib/images/image-contract";
export { AVATAR_PATH_PATTERN };

export function isAvatarPath(path: string) {
  return AVATAR_PATH_PATTERN.test(path) && path === path.trim();
}

export function ownedAvatarPath(url: string | null, origin: string, folder: string) {
  if (url === null) return null;
  const parsed = new URL(url);
  const base = new URL(origin);
  const prefix = "/storage/v1/object/public/avatars/";
  const path = parsed.pathname.slice(prefix.length);
  if (parsed.protocol !== "https:" || parsed.origin !== base.origin
    || parsed.username || parsed.password || parsed.search || parsed.hash
    || !parsed.pathname.startsWith(prefix) || !isAvatarPath(path)
    || !path.startsWith(`${folder}/`)) {
    throw new Error("InvalidAvatarReference");
  }
  return path;
}
