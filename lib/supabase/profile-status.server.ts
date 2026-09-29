import "server-only";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  classifyProfileQuery,
  classifyProfileQueryFailure,
  getSafeCaughtErrorContext,
  getSafeQueryErrorContext,
  type ProfileDataStatus,
} from "@/lib/supabase/profile-status";

export async function getProfileDataStatus(): Promise<ProfileDataStatus> {
  try {
    const supabase = await createServerSupabaseClient();
    const result = await supabase.from("profiles").select("id").maybeSingle();
    const status = classifyProfileQuery(result);

    if (result.error) {
      console.error(
        "Supabase profile check failed",
        getSafeQueryErrorContext(result),
      );
    }

    return status;
  } catch (error) {
    console.error(
      "Supabase profile check could not start",
      getSafeCaughtErrorContext(error),
    );
    return classifyProfileQueryFailure(error);
  }
}