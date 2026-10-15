import "server-only";
import { z } from "zod";
import { commentCountSchema, commentPageSchema, type CommentCursor, type CommentReadResult } from "./comment-contract";
import { likeBatchSchema } from "./like-contract";
import { postCursorSchema } from "./post-cursor";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export async function getPublicComments(postId: string, cursor?: CommentCursor): Promise<CommentReadResult> {
  try {
    z.uuid().parse(postId);
    if (cursor) postCursorSchema.parse(cursor);
    const result = await createPublicSupabaseClient().rpc("get_public_post_comments", {
      p_post_id: postId,
      ...(cursor ? { p_before_created_at: cursor.before, p_before_id: cursor.beforeId } : {}),
    });
    if (result.error) {
      console.error("Public comments read failed", { code: result.error.code });
      return { status: "unavailable" };
    }
    if (result.data === null) return { status: "missing" };
    const page = commentPageSchema.parse(result.data);
    const last = page.comments.at(-1);
    if (new Set(page.comments.map((comment) => comment.id)).size !== page.comments.length
      || page.comments.some((comment) => comment.post_id !== postId)
      || page.commentCount < page.comments.length
      || (page.nextCursor && (page.comments.length !== 12 || page.nextCursor.before !== last?.created_at
        || page.nextCursor.beforeId !== last?.id))) {
      throw new Error("InvalidCommentPageProjection");
    }
    return { status: "ready", page };
  } catch (error) {
    console.error("Public comments unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}

export async function getPostCommentCounts(postIds: string[]): Promise<
  { status: "ready"; counts: z.infer<typeof commentCountSchema>[] } | { status: "unavailable" }
> {
  try {
    const ids = likeBatchSchema.parse(postIds);
    const result = await createPublicSupabaseClient().rpc("get_post_comment_counts", { p_post_ids: ids });
    if (result.error) {
      console.error("Comment counts read failed", { code: result.error.code });
      return { status: "unavailable" };
    }
    const counts = z.array(commentCountSchema).max(12).parse(result.data);
    if (new Set(counts.map((row) => row.post_id)).size !== counts.length
      || counts.some((row) => !ids.includes(row.post_id))) throw new Error("InvalidCommentCountProjection");
    return { status: "ready", counts };
  } catch (error) {
    console.error("Comment counts unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}
