export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
export const AVATAR_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const AVATAR_PATH_PATTERN = /^[a-f0-9]{64}\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.webp$/;

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
