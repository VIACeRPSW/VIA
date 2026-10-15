"use server";

import { getPublicPost, getPublicPosts, type PostListResult } from "@/lib/posts/read-post.server";
import { postCursorSchema, type PostCursor } from "@/lib/posts/post-cursor";

export async function loadFeedPage(cursor: PostCursor): Promise<PostListResult> {
  const parsed = postCursorSchema.safeParse(cursor);
  if (!parsed.success) {
    console.error("Invalid feed cursor");
    return { status: "unavailable" };
  }
  return getPublicPosts({ cursor: parsed.data });
}

export async function refreshPostImage(id: string): Promise<string | null> {
  const result = await getPublicPost(id);
  return result.status === "found" ? result.imageUrl : null;
}
