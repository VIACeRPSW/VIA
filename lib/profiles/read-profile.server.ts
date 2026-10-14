import "server-only";

import { auth } from "@clerk/nextjs/server";
import {
  isCanonicalUsername,
  ownProfileSchema,
  PUBLIC_PROFILE_COLUMNS,
  publicProfileSchema,
  resolveProfileRead,
  type OwnProfile,
  type ProfileReadResult,
  type PublicProfile,
} from "@/lib/profiles/read-profile";
import {
  createPublicSupabaseClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";

export async function getOwnProfile(): Promise<ProfileReadResult<OwnProfile>> {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    return { status: "unauthorized" };
  }

  return resolveProfileRead(async () => {
    const supabase = await createServerSupabaseClient();
    return supabase.from("profiles")
      .select(`id, clerk_user_id, ${PUBLIC_PROFILE_COLUMNS}`)
      .eq("clerk_user_id", userId)
      .maybeSingle();
  }, ownProfileSchema);
}

export async function getPublicProfile(
  username: string,
): Promise<ProfileReadResult<PublicProfile>> {
  if (!isCanonicalUsername(username)) {
    return { status: "missing" };
  }

  return resolveProfileRead(() =>
    createPublicSupabaseClient()
      .rpc("get_public_profile", { p_username: username })
      .maybeSingle(),
  publicProfileSchema);
}
