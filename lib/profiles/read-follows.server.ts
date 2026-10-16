import "server-only";
import { followReadInputSchema, followSummarySchema, type FollowReadResult } from "./follow-contract";
import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function getProfileFollows(input: unknown, viewer = false): Promise<FollowReadResult> {
  try {
    const parsed = followReadInputSchema.parse(input);
    const client = viewer ? await createServerSupabaseClient() : createPublicSupabaseClient();
    const result = await client.rpc("get_profile_follows", "profileId" in parsed
      ? { p_profile_id: parsed.profileId } : { p_username: parsed.username });
    if (result.error) {
      console.error("Profile follow read failed", { code: result.error.code });
      return { status: "unavailable" };
    }
    if (result.data === null) return { status: "missing" };
    const summary = followSummarySchema.parse(result.data);
    if (("profileId" in parsed ? summary.profile_id !== parsed.profileId : summary.username !== parsed.username)
      || (!viewer && summary.viewer !== "anonymous")) throw new Error("InvalidFollowProjection");
    return { status: "ready", summary };
  } catch (error) {
    console.error("Profile follows unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}
