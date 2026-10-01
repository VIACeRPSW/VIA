import {
  type ProfileFieldErrors,
  type ProfileInput,
  validateProfileInput,
} from "@/lib/profiles/profile-contract";

export type CreateProfileResult =
  | { status: "created" | "existing" }
  | { status: "conflict" | "error"; message: string }
  | { status: "invalid"; fieldErrors: ProfileFieldErrors };

export type ProfileRepository = {
  findCurrent(): Promise<{ data: { id: string } | null; errorCode?: string }>;
  insert(
    profile: ProfileInput,
  ): Promise<{ errorCode?: string; status?: number }>;
};

type ErrorLogger = (message: string, context: Record<string, unknown>) => void;

export async function createProfile(
  input: unknown,
  repository: ProfileRepository,
  logError: ErrorLogger = console.error,
): Promise<CreateProfileResult> {
  const validation = validateProfileInput(input);

  if (!validation.success) {
    return { status: "invalid", fieldErrors: validation.fieldErrors };
  }

  let current: Awaited<ReturnType<ProfileRepository["findCurrent"]>>;

  try {
    current = await repository.findCurrent();
  } catch (error) {
    logError("Profile lookup could not start", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "error",
      message: "No pudimos comprobar tu perfil. Inténtalo de nuevo.",
    };
  }

  if (current.errorCode) {
    logError("Profile lookup failed", { code: current.errorCode });
    return {
      status: "error",
      message: "No pudimos comprobar tu perfil. Inténtalo de nuevo.",
    };
  }

  if (current.data) {
    return { status: "existing" };
  }

  let inserted: Awaited<ReturnType<ProfileRepository["insert"]>>;

  try {
    inserted = await repository.insert(validation.data);
  } catch (error) {
    logError("Profile creation could not start", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return {
      status: "error",
      message: "No pudimos crear tu perfil. Inténtalo de nuevo.",
    };
  }

  if (!inserted.errorCode) {
    return { status: "created" };
  }

  if (inserted.errorCode === "23505") {
    return {
      status: "conflict",
      message: "Ese nombre de usuario ya está ocupado.",
    };
  }

  logError("Profile creation failed", {
    code: inserted.errorCode,
    status: inserted.status ?? 0,
  });
  return {
    status: "error",
    message: "No pudimos crear tu perfil. Inténtalo de nuevo.",
  };
}