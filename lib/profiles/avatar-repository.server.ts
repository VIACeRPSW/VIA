import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ownedAvatarPath } from "@/lib/profiles/avatar-path";
import type { AvatarRepository } from "@/lib/profiles/avatar-operation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export function avatarFolder(userId: string) {
  return createHash("sha256").update(userId).digest("hex");
}
function errorCode(error: { code?: string; name?: string } | null) {
  return error ? error.code || error.name || "SUPABASE_ERROR" : undefined;
}
const taskSchema = z.object({
  object_path: z.string(),
  state: z.enum(["uploading", "cleanup"]),
  expires_at: z.iso.datetime({ offset: true }),
});

export function avatarRepository(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  userId: string,
): AvatarRepository {
  return {
    async plan(path) {
      const result = await client.from("avatar_cleanup_tasks").insert({ object_path: path });
      return { errorCode: errorCode(result.error) };
    },
    async upload(path, buffer) {
      const result = await client.storage.from("avatars")
        .upload(path, buffer, { contentType: "image/webp", upsert: false, cacheControl: "3600" });
      return { errorCode: errorCode(result.error) };
    },
    async abort(path) {
      const result = await client.from("avatar_cleanup_tasks")
        .update({ state: "cleanup" }).eq("object_path", path).eq("owner_sub", userId);
      return { errorCode: errorCode(result.error) };
    },
    async commit(expectedUrl, newUrl, path) {
      const result = await client.rpc("commit_profile_avatar", {
        p_expected_url: expectedUrl, p_new_url: newUrl, p_object_path: path,
      });
      return {
        errorCode: errorCode(result.error),
        committed: result.data === true,
      };
    },
    async cleanup() {
      try {
        const profile = await client.from("profiles").select("avatar_url")
          .eq("clerk_user_id", userId).maybeSingle();
        if (profile.error) {
          console.error("Avatar cleanup profile check failed", { code: errorCode(profile.error) });
          return false;
        }
        const origin = process.env.NEXT_PUBLIC_SUPABASE_URL;
        if (!origin) throw new Error("AvatarConfigurationError");
        const activePath = ownedAvatarPath(profile.data?.avatar_url ?? null, origin, avatarFolder(userId));
        const result = await client.from("avatar_cleanup_tasks")
          .select("object_path, state, expires_at").eq("owner_sub", userId)
          .order("expires_at").limit(100);
        if (result.error) {
          console.error("Avatar cleanup lookup failed", { code: errorCode(result.error) });
          return false;
        }
        const tasks = z.array(taskSchema).safeParse(result.data);
        if (!tasks.success) throw new Error("AvatarCleanupContractError");
        for (const task of tasks.data) {
          const url = client.storage.from("avatars").getPublicUrl(task.object_path).data.publicUrl;
          ownedAvatarPath(url, origin, avatarFolder(userId));
          if (task.object_path === activePath
            || (task.state === "uploading" && Date.parse(task.expires_at) > Date.now())) continue;
          const removed = await client.storage.from("avatars").remove([task.object_path]);
          if (removed.error) {
            console.error("Avatar object cleanup failed", { code: errorCode(removed.error) });
            return false;
          }
          const completed = await client.from("avatar_cleanup_tasks")
            .delete().eq("object_path", task.object_path).eq("owner_sub", userId);
          if (completed.error) {
            console.error("Avatar cleanup journal update failed", { code: errorCode(completed.error) });
            return false;
          }
        }
        const remaining = await client.from("avatar_cleanup_tasks")
          .select("object_path", { count: "exact", head: true }).eq("owner_sub", userId);
        if (remaining.error || remaining.count === null) {
          console.error("Avatar cleanup verification failed", { code: errorCode(remaining.error) ?? "UNKNOWN_COUNT" });
          return false;
        }
        return remaining.count === 0;
      } catch (error) {
        console.error("Avatar cleanup could not complete", getSafeCaughtErrorContext(error));
        return false;
      }
    },
  };
}

export async function getAvatarCleanupStatus() {
  try {
    const client = await createServerSupabaseClient();
    const result = await client.from("avatar_cleanup_tasks").select("object_path", { count: "exact", head: true });
    if (result.error || result.count === null) {
      console.error("Avatar cleanup status failed", { code: errorCode(result.error) ?? "UNKNOWN_COUNT" });
      return { pending: false, unavailable: true };
    }
    return { pending: result.count > 0, unavailable: false };
  } catch (error) {
    console.error("Avatar cleanup status could not start", getSafeCaughtErrorContext(error));
    return { pending: false, unavailable: true };
  }
}
