import { z } from "zod";

export const postCursorSchema = z.object({
  before: z.iso.datetime({ offset: true }),
  beforeId: z.uuid(),
});
export type PostCursor = z.infer<typeof postCursorSchema>;
export type PostSearchParams = Record<string, string | string[] | undefined>;

export function parsePostCursor(params: PostSearchParams):
  { valid: true; cursor?: PostCursor } | { valid: false } {
  if (params.before === undefined && params.beforeId === undefined) return { valid: true };
  const parsed = postCursorSchema.safeParse({ before: params.before, beforeId: params.beforeId });
  return parsed.success ? { valid: true, cursor: parsed.data } : { valid: false };
}
