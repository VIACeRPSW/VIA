import { z } from "zod";

export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;
export const DISPLAY_NAME_MAX_LENGTH = 80;
export const BIO_MAX_LENGTH = 300;

const profileInputSchema = z.object({
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(USERNAME_MIN_LENGTH, "Usa al menos 3 caracteres.")
    .max(USERNAME_MAX_LENGTH, "Usa como máximo 30 caracteres.")
    .regex(
      /^[a-z0-9_]+$/,
      "Usa solo letras minúsculas, números y guion bajo.",
    ),
  displayName: z
    .string()
    .trim()
    .min(1, "Escribe tu nombre visible.")
    .max(DISPLAY_NAME_MAX_LENGTH, "Usa como máximo 80 caracteres."),
  bio: z
    .string()
    .trim()
    .max(BIO_MAX_LENGTH, "Usa como máximo 300 caracteres."),
});

export type ProfileInput = z.infer<typeof profileInputSchema>;

export type ProfileFieldErrors = Partial<
  Record<keyof ProfileInput, string[]>
>;

export type ProfileInputResult =
  | { success: true; data: ProfileInput }
  | { success: false; fieldErrors: ProfileFieldErrors };

export function validateProfileInput(input: unknown): ProfileInputResult {
  const result = profileInputSchema.safeParse(input);

  if (result.success) {
    return result;
  }

  return {
    success: false,
    fieldErrors: result.error.flatten().fieldErrors,
  };
}

export function profileInputFromFormData(formData: FormData) {
  return {
    username: String(formData.get("username") ?? ""),
    displayName: String(formData.get("displayName") ?? ""),
    bio: String(formData.get("bio") ?? ""),
  };
}