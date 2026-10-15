import { z } from "zod";
import { postCursorSchema, type PostCursor } from "@/lib/posts/post-cursor";

export const COMMENT_MAX_LENGTH = 1000;
export const commentContentSchema = z.string().trim()
  .refine((content) => content.isWellFormed() && !content.includes("\0"), "Usa texto Unicode válido, sin caracteres nulos.")
  .refine((content) => [...content].length >= 1 && [...content].length <= COMMENT_MAX_LENGTH,
    "Escribe de 1 a 1000 caracteres.");
export const commentInputSchema = z.object({
  postId: z.uuid(), operationId: z.uuid(), content: commentContentSchema,
}).strict();
export const publicCommentSchema = z.object({
  id: z.uuid(), post_id: z.uuid(), content: z.string().min(1)
    .refine((content) => [...content].length <= COMMENT_MAX_LENGTH && content === content.trim()),
  created_at: z.iso.datetime({ offset: true }),
  author_username: z.string().regex(/^[a-z0-9_]{3,30}$/),
  author_display_name: z.string().min(1),
});
const countSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const commentPageSchema = z.object({
  comments: z.array(publicCommentSchema).max(12),
  commentCount: countSchema, nextCursor: postCursorSchema.nullable(),
});
export const commentCreatedSchema = z.object({ comment: publicCommentSchema, commentCount: countSchema.min(1) });
export const commentCountSchema = z.object({ post_id: z.uuid(), comment_count: countSchema });
export type PublicComment = z.infer<typeof publicCommentSchema>;
export type CommentCursor = PostCursor;
export type CommentPage = z.infer<typeof commentPageSchema>;
export type CommentReadResult =
  | { status: "ready"; page: CommentPage }
  | { status: "missing" }
  | { status: "unavailable" };
export type CommentActionResult =
  | ({ status: "success" } & z.infer<typeof commentCreatedSchema>)
  | { status: "invalid" | "unauthorized" | "profile-required" | "conflict" | "error"; message: string };
