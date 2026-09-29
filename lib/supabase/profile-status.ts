import { SupabaseConfigurationError } from "@/lib/supabase/errors";

export type ProfileQueryResult = {
  data: { id: string } | null;
  error: { code: string } | null;
  status: number;
};

type ErrorLogger = (message: string, context: Record<string, unknown>) => void;

export type ProfileDataStatus =
  | "configuration-invalid"
  | "profile-found"
  | "ready"
  | "temporarily-unavailable"
  | "unauthorized";

export function classifyProfileQuery(
  result: ProfileQueryResult,
): ProfileDataStatus {
  if (!result.error) {
    return result.data ? "profile-found" : "ready";
  }

  if (result.status === 401 || result.status === 403) {
    return "unauthorized";
  }

  return "temporarily-unavailable";
}

export function classifyProfileQueryFailure(
  error: unknown,
): ProfileDataStatus {
  return error instanceof SupabaseConfigurationError
    ? "configuration-invalid"
    : "temporarily-unavailable";
}

export function getProfileDataStatusLabel(status: ProfileDataStatus) {
  return {
    "configuration-invalid": "Integración de datos pendiente",
    "profile-found": "Perfil de datos conectado",
    ready: "Conexión lista; perfil pendiente de la Fase 2",
    "temporarily-unavailable": "Datos temporalmente no disponibles",
    unauthorized: "Conexión de datos no autorizada",
  }[status];
}

export function getSafeQueryErrorContext(result: ProfileQueryResult) {
  return {
    code: result.error?.code ?? "unknown",
    status: result.status,
  };
}

export function getSafeCaughtErrorContext(error: unknown) {
  return {
    errorType: error instanceof Error ? error.name : "UnknownError",
  };
}

export async function resolveProfileDataStatus(
  query: () => Promise<ProfileQueryResult>,
  logError: ErrorLogger = console.error,
): Promise<ProfileDataStatus> {
  try {
    const result = await query();
    const status = classifyProfileQuery(result);

    if (result.error) {
      logError("Supabase profile check failed", getSafeQueryErrorContext(result));
    }

    return status;
  } catch (error) {
    logError(
      "Supabase profile check could not start",
      getSafeCaughtErrorContext(error),
    );
    return classifyProfileQueryFailure(error);
  }
}