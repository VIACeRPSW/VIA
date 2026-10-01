import "server-only";

import { auth } from "@clerk/nextjs/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  resolveProfileDataStatus,
  type ProfileDataStatus,
} from "@/lib/supabase/profile-status";

export async function getProfileDataStatus(): Promise<ProfileDataStatus> {
  return resolveProfileDataStatus(async () => {
    const { userId } = await auth();

    if (!userId) {
      return {
        data: null,
        error: { code: "AUTH_REQUIRED" },
        status: 401,
      };
    }

    const supabase = await createServerSupabaseClient();
    return supabase
      .from("profiles")
      .select("id")
      .eq("clerk_user_id", userId)
      .maybeSingle();
  });
}