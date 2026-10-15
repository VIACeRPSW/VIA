import "server-only";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import { IMAGE_PATH_PATTERN } from "@/lib/images/image-contract";
import { canonicalHashtagsSchema, categorySchema, ownPostSchema, type OwnPost } from "@/lib/posts/post-contract";
import { createPublicSupabaseClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";
import { postCursorSchema, type PostCursor } from "@/lib/posts/post-cursor";

const publicPostSchema = z.object({
  id: z.uuid(), title: z.string().min(1), description: z.string(), hashtags: canonicalHashtagsSchema,
  image_path: z.string().regex(IMAGE_PATH_PATTERN).refine((path) => path === path.trim()),
  category_id: z.uuid(), category_name: z.string(),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }),
  author_username: z.string().regex(/^[a-z0-9_]{3,30}$/),
  author_display_name: z.string(), author_avatar_url: z.string().nullable(),
});
type PublicPost = z.infer<typeof publicPostSchema>;
export type PostWithImage = { post: PublicPost; imageUrl: string | null };
export type PostListResult =
  | { status: "ready"; posts: PostWithImage[]; nextCursor: PostCursor | null }
  | { status: "unavailable" };

export async function getOwnPost(id: string): Promise<
  { status: "found"; post: OwnPost } | { status: "missing" | "unauthorized" | "unavailable" }
> {
  if (!z.uuid().safeParse(id).success) return { status: "missing" };
  try {
    const session = await auth();
    if (!session.isAuthenticated) return { status: "unauthorized" };
    const client = await createServerSupabaseClient();
    const result = await client.from("posts")
      .select("id,title,description,category_id,hashtags,version").eq("id", id).maybeSingle();
    if (result.error) throw new Error("OwnPostQueryError");
    return result.data ? { status: "found", post: ownPostSchema.parse(result.data) } : { status: "missing" };
  } catch (error) {
    console.error("Own post unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}

export async function getOwnPostCount(): Promise<
  { status: "ready"; count: number } | { status: "unavailable" }
> {
  try {
    const client = await createServerSupabaseClient();
    const result = await client.from("posts").select("id", { head: true, count: "exact" });
    if (result.error || result.count === null) throw new Error("OwnPostCountQueryError");
    return { status: "ready", count: result.count };
  } catch (error) {
    console.error("Own post count unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}

async function signPostImage(
  client: ReturnType<typeof createPublicSupabaseClient>, post: PublicPost,
): Promise<string | null> {
  const signed = await client.storage.from("posts").createSignedUrl(post.image_path, 60);
  if (signed.error) {
    console.error("Public post image signing failed", { code: signed.error.name });
    return null;
  }
  const url = new URL(signed.data.signedUrl);
  const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  if (url.protocol !== "https:" || url.origin !== origin.origin
    || url.pathname !== `/storage/v1/object/sign/posts/${post.image_path}`
    || !url.searchParams.has("token") || url.username || url.password || url.hash) {
    throw new Error("InvalidPostImageReference");
  }
  return url.href;
}

export async function getPublicPosts(options: {
  authorUsername?: string; cursor?: PostCursor;
} = {}): Promise<PostListResult> {
  try {
    if (options.cursor) postCursorSchema.parse(options.cursor);
    if (options.authorUsername !== undefined) z.string().regex(/^[a-z0-9_]{3,30}$/).parse(options.authorUsername);
    const client = createPublicSupabaseClient();
    const result = await client.rpc("get_public_posts", {
      ...(options.authorUsername ? { p_author_username: options.authorUsername } : {}),
      ...(options.cursor ? {
        p_before_created_at: options.cursor.before, p_before_id: options.cursor.beforeId,
      } : {}),
    });
    if (result.error) throw new Error("PublicPostListQueryError");
    const rows = z.array(publicPostSchema).max(12).parse(result.data);
    const posts = await Promise.all(rows.map(async (post) => ({
      post, imageUrl: await signPostImage(client, post),
    })));
    const last = rows.at(-1);
    return { status: "ready", posts, nextCursor: rows.length === 12 && last
      ? { before: last.created_at, beforeId: last.id } : null };
  } catch (error) {
    console.error("Public post list unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}

export async function getPostCategories(): Promise<
  { status: "ready"; categories: z.infer<typeof categorySchema>[] } | { status: "unavailable" }
> {
  try {
    const result = await createPublicSupabaseClient().from("categories").select("id, name").order("name");
    if (result.error) throw new Error("PostCategoryQueryError");
    const categories = z.array(categorySchema).min(1).parse(result.data);
    return { status: "ready", categories };
  } catch (error) {
    console.error("Post categories unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}

export async function getPublicPost(id: string): Promise<
  { status: "found"; post: PublicPost; imageUrl: string | null }
  | { status: "missing" | "unavailable" }
> {
  if (!z.uuid().safeParse(id).success) return { status: "missing" };
  try {
    const client = createPublicSupabaseClient();
    const result = await client.rpc("get_public_posts", { p_id: id }).maybeSingle();
    if (result.error) throw new Error("PublicPostQueryError");
    if (result.data === null) return { status: "missing" };
    const post = publicPostSchema.parse(result.data);
    return { status: "found", post, imageUrl: await signPostImage(client, post) };
  } catch (error) {
    console.error("Public post unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}
