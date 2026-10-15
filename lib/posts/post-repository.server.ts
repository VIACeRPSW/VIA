import "server-only";
import { z } from "zod";
import { IMAGE_PATH_PATTERN } from "@/lib/images/image-contract";
import type { PostRepository } from "@/lib/posts/publish-post";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const pathSchema = z.string().regex(IMAGE_PATH_PATTERN).refine((path) => path === path.trim());
const beginSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("ready"), image_path: pathSchema }),
  z.object({ status: z.literal("published"), post_id: z.uuid() }),
  z.object({ status: z.literal("busy") }),
  z.object({ status: z.literal("conflict") }),
  z.object({ status: z.literal("cleanup") }),
]);
const cleanupSchema = z.array(z.object({
  operation_id: z.uuid(), image_path: pathSchema,
  state: z.enum(["uploading", "published", "cleanup"]), expires_at: z.iso.datetime({ offset: true }),
}));

function check(error: { code?: string; name?: string } | null) {
  if (error) {
    console.error("Post data operation failed", { code: error.code || error.name || "POST_SERVICE_ERROR" });
    throw new Error("PostServiceError");
  }
}

export function postRepository(
  client: Awaited<ReturnType<typeof createServerSupabaseClient>>, userId: string,
): PostRepository {
  return {
    async begin(input, digest, lease) {
      const result = await client.rpc("begin_post_upload", {
        p_operation_id: input.operationId, p_lease_id: lease,
        p_title: input.title, p_description: input.description,
        p_category_id: input.categoryId, p_hashtags: input.hashtags, p_image_digest: digest,
      });
      check(result.error);
      return beginSchema.parse(result.data);
    },
    async upload(path, bytes) {
      const result = await client.storage.from("posts").upload(path, bytes, {
        contentType: "image/webp", cacheControl: "0", upsert: false,
      });
      check(result.error);
    },
    async commit(operation, lease) {
      const result = await client.rpc("commit_post_upload", { p_operation_id: operation, p_lease_id: lease });
      check(result.error);
      return z.uuid().parse(result.data);
    },
    async abort(operation, lease) {
      const result = await client.rpc("abort_post_upload", { p_operation_id: operation, p_lease_id: lease });
      check(result.error);
    },
    async cleanup() {
      const result = await client.from("post_uploads")
        .select("operation_id, image_path, state, expires_at").eq("owner_sub", userId)
        .neq("state", "published").order("expires_at").limit(100);
      check(result.error);
      const uploads = cleanupSchema.parse(result.data);
      for (const upload of uploads) {
        if (upload.state === "uploading" && Date.parse(upload.expires_at) > Date.now()) continue;
        const removed = await client.storage.from("posts").remove([upload.image_path]);
        check(removed.error);
        const finished = await client.rpc("finish_post_cleanup", { p_operation_id: upload.operation_id });
        check(finished.error);
      }
      const remaining = await client.from("post_uploads")
        .select("operation_id", { head: true, count: "exact" }).eq("owner_sub", userId).neq("state", "published");
      check(remaining.error);
      if (remaining.count === null) throw new Error("PostCleanupCountUnavailable");
      return remaining.count === 0;
    },
  };
}
