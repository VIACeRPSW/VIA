import { z } from "zod";
export { IMAGE_MIME_TYPES } from "@/lib/images/image-contract";

export const POST_MAX_BYTES = 5 * 1024 * 1024;
export function normalizeHashtags(input: string) {
  return [...new Set(input.trim().split(/[\s,]+/u).filter(Boolean)
    .map((tag) => tag.replace(/^#/, "").toLowerCase().normalize("NFC")))].sort();
}
const length = (value: string) => Array.from(value).length;
const hashtagSchema = z.string()
  .refine((tag) => length(tag) >= 2 && length(tag) <= 30
    && /^[\p{L}\p{N}_]+$/u.test(tag) && tag === tag.toLowerCase().normalize("NFC"),
  "Cada hashtag debe tener de 2 a 30 letras, números o guiones bajos.");
export const canonicalHashtagsSchema = z.array(hashtagSchema).min(1).max(5)
  .refine((tags) => new Set(tags).size === tags.length);
export const postInputSchema = z.object({
  operationId: z.uuid("Recarga el formulario antes de publicar."),
  title: z.string().trim().min(1, "Escribe un título.")
    .refine((value) => length(value) <= 120, "El título admite hasta 120 caracteres."),
  description: z.string().refine((value) => length(value) <= 2000, "La descripción admite hasta 2000 caracteres."),
  categoryId: z.uuid("Selecciona una categoría."),
  hashtags: z.string().max(1000, "Reduce la cantidad de hashtags.").transform(normalizeHashtags)
    .pipe(canonicalHashtagsSchema),
});
export type PostInput = z.infer<typeof postInputSchema>;
export type PostField = "title" | "description" | "categoryId" | "hashtags" | "image";
export type PostActionState = {
  status: "idle" | "invalid" | "error" | "unauthorized" | "busy" | "conflict" | "success";
  message?: string;
  fieldErrors?: Partial<Record<PostField, string>>;
  postId?: string;
  cleanupPending?: boolean;
};
export const initialPostState: PostActionState = { status: "idle" };
export const categorySchema = z.object({ id: z.uuid(), name: z.string().min(1) });
