import { z } from "zod";

export type PostShareLink =
  | { status: "ready"; url: string }
  | { status: "unavailable"; message: string };
export type ShareResult = {
  status: "copied" | "shared" | "cancelled" | "unsupported" | "error";
  message: string;
};

export function buildPostShareLink(postId: string, configuredOrigin: string | undefined, environment: string): PostShareLink {
  if (!z.uuid().safeParse(postId).success) {
    return { status: "unavailable", message: "El enlace de esta publicación no es válido." };
  }
  const origin = configuredOrigin || (environment === "development" ? "http://localhost:3000" : undefined);
  if (!origin) {
    return { status: "unavailable", message: "El enlace público no está configurado. No se puede compartir esta publicación." };
  }
  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return { status: "unavailable", message: "El origen público configurado no es válido." };
  }
  const local = parsed.hostname === "localhost" || parsed.hostname.endsWith(".localhost")
    || parsed.hostname.startsWith("127.") || parsed.hostname === "[::1]" || parsed.hostname === "0.0.0.0";
  if ((origin !== parsed.origin && origin !== `${parsed.origin}/`)
    || parsed.username || parsed.password
    || (parsed.protocol !== "https:" && !(environment === "development" && local && parsed.protocol === "http:"))
    || (local && environment !== "development")) {
    return { status: "unavailable", message: "El origen público configurado no está permitido." };
  }
  return { status: "ready", url: `${parsed.origin}/post/${postId.toLowerCase()}` };
}

export function getPostShareLink(postId: string): PostShareLink {
  return buildPostShareLink(postId, process.env.NEXT_PUBLIC_APP_ORIGIN, process.env.NODE_ENV);
}

export async function copyPostLink(url: string, clipboard: Pick<Clipboard, "writeText"> | undefined): Promise<ShareResult> {
  if (typeof clipboard?.writeText !== "function") {
    return { status: "unsupported", message: "Este navegador no permite copiar automáticamente. Selecciona el enlace y cópialo manualmente." };
  }
  try {
    await clipboard.writeText(url);
    return { status: "copied", message: "Enlace copiado." };
  } catch (error) {
    console.error("Post link copy failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return { status: "error", message: "No pudimos copiar el enlace. Selecciónalo y cópialo manualmente." };
  }
}

export async function sharePostLink(url: string, share: ((data: ShareData) => Promise<void>) | undefined): Promise<ShareResult> {
  if (!share) {
    return { status: "unsupported", message: "Este navegador no ofrece compartir nativo. Puedes copiar el enlace." };
  }
  try {
    await share({ url });
    return { status: "shared", message: "Acción de compartir completada." };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { status: "cancelled", message: "Compartir cancelado. Puedes copiar el enlace si lo prefieres." };
    }
    console.error("Native post share failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return { status: "error", message: "No pudimos compartir el enlace. Puedes copiarlo o intentarlo de nuevo." };
  }
}
