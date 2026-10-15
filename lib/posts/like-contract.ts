import { z } from "zod";

export const likeInputSchema = z.object({ postId: z.uuid(), liked: z.boolean() }).strict();
export const likeBatchSchema = z.array(z.uuid()).min(1).max(12)
  .refine((ids) => new Set(ids).size === ids.length);
export const postLikeSchema = z.object({
  post_id: z.uuid(), like_count: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  liked: z.boolean().nullable(), can_like: z.boolean(),
});
export type PostLike = z.infer<typeof postLikeSchema>;
export type LikeReadResult =
  | { status: "ready"; likes: PostLike[] }
  | { status: "unavailable" };
export type LikeActionResult =
  | { status: "success"; like: PostLike }
  | { status: "error" | "unauthorized"; message: string };
