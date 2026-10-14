import { z } from "zod";
import {
  type ProfileFieldErrors,
  type ProfileInput,
  validateProfileInput,
} from "@/lib/profiles/profile-contract";
import { isCanonicalUsername } from "@/lib/profiles/read-profile";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

type QueryResult = {
  data: unknown;
  errorCode?: string;
  status?: number;
};

export type ProfileUpdateRepository = {
  findCurrent(): Promise<QueryResult>;
  update(id: string, profile: ProfileInput): Promise<QueryResult>;
};

export type UpdateProfileResult =
  | { status: "updated"; previousUsername: string; values: ProfileInput }
  | { status: "invalid"; fieldErrors: ProfileFieldErrors }
  | { status: "conflict" | "error" | "unauthorized"; message: string };

const currentProfileSchema = z.object({
  id: z.uuid(),
  username: z.string().refine(isCanonicalUsername),
});
const updatedProfileSchema = z.object({ id: z.uuid() });
const temporaryMessage = "No pudimos actualizar tu perfil. Inténtalo de nuevo.";
const unauthorizedMessage = "Tu sesión no está disponible. Vuelve a iniciar sesión.";

export async function updateProfile(
  input: unknown,
  repository: ProfileUpdateRepository,
  logError: (message: string, context: Record<string, unknown>) => void = console.error,
): Promise<UpdateProfileResult> {
  const validation = validateProfileInput(input);

  if (!validation.success) {
    return { status: "invalid", fieldErrors: validation.fieldErrors };
  }

  let current: QueryResult;

  try {
    current = await repository.findCurrent();
  } catch (error) {
    logError("Profile update lookup could not start", getSafeCaughtErrorContext(error));
    return { status: "error", message: temporaryMessage };
  }

  if (current.errorCode || current.status === 0
    || (current.status !== undefined && current.status >= 400)) {
    logError("Profile update lookup failed", {
      code: current.errorCode || "unknown",
      status: current.status ?? 0,
    });
    return current.status === 401 || current.status === 403
      ? { status: "unauthorized", message: unauthorizedMessage }
      : { status: "error", message: temporaryMessage };
  }

  if (current.data === null) {
    return {
      status: "error",
      message: "Tu perfil ya no está disponible. Vuelve a tu perfil para completarlo.",
    };
  }

  const profile = currentProfileSchema.safeParse(current.data);
  if (!profile.success) {
    logError("Profile update lookup violated the contract", { code: "INVALID_PROFILE_RESPONSE" });
    return { status: "error", message: temporaryMessage };
  }

  let updated: QueryResult;

  try {
    updated = await repository.update(profile.data.id, validation.data);
  } catch (error) {
    logError("Profile update could not start", getSafeCaughtErrorContext(error));
    return { status: "error", message: temporaryMessage };
  }

  if (updated.errorCode === "23505") {
    return { status: "conflict", message: "Ese nombre de usuario ya está ocupado." };
  }

  if (updated.errorCode || updated.status === 0
    || (updated.status !== undefined && updated.status >= 400)) {
    logError("Profile update failed", {
      code: updated.errorCode || "unknown",
      status: updated.status ?? 0,
    });
    return updated.status === 401 || updated.status === 403
      ? { status: "unauthorized", message: unauthorizedMessage }
      : { status: "error", message: temporaryMessage };
  }

  const persisted = updatedProfileSchema.safeParse(updated.data);
  if (!persisted.success || persisted.data.id !== profile.data.id) {
    logError("Profile update did not confirm the own row", { code: "PROFILE_UPDATE_NOT_CONFIRMED" });
    return { status: "error", message: temporaryMessage };
  }

  return {
    status: "updated",
    previousUsername: profile.data.username,
    values: validation.data,
  };
}
