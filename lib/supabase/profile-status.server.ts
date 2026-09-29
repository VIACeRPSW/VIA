import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  resolveProfileDataStatus,
  type ProfileDataStatus,
} from "@/lib/supabase/profile-status";

export async function getProfileDataStatus(): Promise<ProfileDataStatus> {
  return resolveProfileDataStatus(async () => {
    const supabase = await createServerSupabaseClient();
    return supabase.from("profiles").select("id").maybeSingle();
  });
}