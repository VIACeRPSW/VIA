import { z } from "zod";
import {
  BIO_MAX_LENGTH,
  DISPLAY_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MIN_LENGTH,
} from "@/lib/profiles/profile-contract";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";
import { isAvatarPath } from "@/lib/profiles/avatar-path";

export const PUBLIC_PROFILE_COLUMNS =
  "username, display_name, bio, avatar_url, role";

const canonicalUsernameSchema = z.string()
  .min(USERNAME_MIN_LENGTH)
  .max(USERNAME_MAX_LENGTH)
  .regex(/^[a-z0-9_]+$/)
  .refine((username) => username === username.trim());

const profileFields = {
  username: canonicalUsernameSchema,
  display_name: z.string().trim().min(1).max(DISPLAY_NAME_MAX_LENGTH),
  bio: z.string().max(BIO_MAX_LENGTH),
  avatar_url: z.string().nullable(),
  role: z.enum(["user", "moderator", "admin"]),
};

function publicFields(row: z.infer<z.ZodObject<typeof profileFields>>) {
  return {
    username: row.username,
    displayName: row.display_name,
    bio: row.bio,
    avatarUrl: row.avatar_url,
    role: row.role,
  };
}

export const publicProfileSchema = z.object(profileFields).transform(publicFields);
export const ownProfileSchema = z.object({
  ...profileFields,
  id: z.uuid(),
  clerk_user_id: z.string().min(1),
}).transform((row) => ({
  ...publicFields(row),
  id: row.id,
  clerkUserId: row.clerk_user_id,
}));

export type PublicProfile = z.infer<typeof publicProfileSchema>;
export type OwnProfile = z.infer<typeof ownProfileSchema>;
export type ProfileReadResult<T> =
  | { status: "found"; profile: T }
  | { status: "missing" | "unavailable" | "unauthorized" };

type ProfileQuery = () => PromiseLike<{
  data: unknown;
  error: { code?: string } | null;
  status: number;
}>;

export function isCanonicalUsername(username: string) {
  return canonicalUsernameSchema.safeParse(username).success;
}

export async function resolveProfileRead<T>(
  query: ProfileQuery,
  schema: z.ZodType<T>,
): Promise<ProfileReadResult<T>> {
  try {
    const result = await query();

    if (result.error) {
      console.error("Supabase profile read failed", {
        code: result.error.code ?? "unknown",
        status: result.status,
      });
      return {
        status: result.status === 401 || result.status === 403
          ? "unauthorized"
          : "unavailable",
      };
    }

    if (result.data === null) {
      return { status: "missing" };
    }

    const profile = schema.safeParse(result.data);

    if (!profile.success) {
      console.error("Supabase profile response violated the contract", {
        code: "INVALID_PROFILE_RESPONSE",
      });
      return { status: "unavailable" };
    }

    return { status: "found", profile: profile.data };
  } catch (error) {
    console.error("Supabase profile read could not start", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}

export function getSafeAvatarUrl(
  avatarUrl: string | null,
  supabaseUrl: string | undefined,
): string | null {
  if (avatarUrl === null) return null;

  const avatar = z.url().safeParse(avatarUrl);
  const origin = z.url().safeParse(supabaseUrl);

  if (avatar.success && origin.success) {
    const url = new URL(avatar.data);
    const configured = new URL(origin.data);

    if (
      url.protocol === "https:"
      && url.origin === configured.origin
      && !url.username
      && !url.password
      && !url.search
      && !url.hash
      && url.pathname.startsWith("/storage/v1/object/public/avatars/")
      && isAvatarPath(url.pathname.slice("/storage/v1/object/public/avatars/".length))
    ) {
      return url.href;
    }
  }

  console.error("Profile avatar reference is not allowed", {
    code: "INVALID_AVATAR_REFERENCE",
  });
  return null;
}
