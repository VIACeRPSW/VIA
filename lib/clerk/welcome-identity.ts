export type ClerkIdentityInput = {
  firstName?: string | null;
  fullName?: string | null;
  primaryEmailAddress?: { emailAddress: string } | null;
};

export type WelcomeIdentityStatus =
  | "complete"
  | "incomplete"
  | "unavailable";

export type WelcomeIdentity = {
  displayName: string;
  email: string;
  status: WelcomeIdentityStatus;
};

type ErrorLogger = (message: string, context: Record<string, unknown>) => void;

function getNonEmptyValue(...values: Array<string | null | undefined>) {
  return values.find((value) => value?.trim())?.trim();
}

export function toWelcomeIdentity(
  user: ClerkIdentityInput | null,
): WelcomeIdentity {
  if (!user) {
    return {
      displayName: "estudiante",
      email: "Cuenta de Clerk conectada",
      status: "unavailable",
    };
  }

  const displayName = getNonEmptyValue(user.firstName, user.fullName);
  const email = getNonEmptyValue(user.primaryEmailAddress?.emailAddress);

  return {
    displayName: displayName ?? "estudiante",
    email: email ?? "Cuenta de Clerk conectada",
    status: displayName && email ? "complete" : "incomplete",
  };
}

export function getWelcomeIdentityStatusLabel(status: WelcomeIdentityStatus) {
  return {
    complete: "Identidad disponible",
    incomplete: "Identidad parcial; puedes completar tus datos en Clerk",
    unavailable: "Identidad temporalmente no disponible",
  }[status];
}

export async function resolveWelcomeIdentity(
  loadUser: () => Promise<ClerkIdentityInput | null>,
  logError: ErrorLogger = console.error,
) {
  try {
    return toWelcomeIdentity(await loadUser());
  } catch (error) {
    logError("Clerk identity lookup failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return toWelcomeIdentity(null);
  }
}