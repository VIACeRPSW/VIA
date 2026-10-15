import "server-only";
import { z } from "zod";
import { IMAGE_PATH_PATTERN } from "@/lib/images/image-contract";
import { canonicalHashtagsSchema, categorySchema } from "@/lib/posts/post-contract";
import { createPublicSupabaseClient } from "@/lib/supabase/server";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

const publicPostSchema = z.object({
  id: z.uuid(), title: z.string().min(1), description: z.string(), hashtags: canonicalHashtagsSchema,
  image_path: z.string().regex(IMAGE_PATH_PATTERN).refine((path) => path === path.trim()),
  category_id: z.uuid(), category_name: z.string(),
  created_at: z.iso.datetime({ offset: true }), updated_at: z.iso.datetime({ offset: true }),
  author_username: z.string().regex(/^[a-z0-9_]{3,30}$/),
  author_display_name: z.string(), author_avatar_url: z.string().nullable(),
});
type PublicPost = z.infer<typeof publicPostSchema>;

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
    const signed = await client.storage.from("posts").createSignedUrl(post.image_path, 60);
    if (signed.error) {
      console.error("Public post image signing failed", { code: signed.error.name });
      return { status: "found", post, imageUrl: null };
    }
    const url = new URL(signed.data.signedUrl);
    const origin = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
    if (url.protocol !== "https:" || url.origin !== origin.origin
      || url.pathname !== `/storage/v1/object/sign/posts/${post.image_path}`
      || !url.searchParams.has("token") || url.username || url.password || url.hash) {
      throw new Error("InvalidPostImageReference");
    }
    return { status: "found", post, imageUrl: url.href };
  } catch (error) {
    console.error("Public post unavailable", getSafeCaughtErrorContext(error));
    return { status: "unavailable" };
  }
}
