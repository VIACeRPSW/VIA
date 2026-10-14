import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export type AvatarActionState = {
  status: "idle" | "success" | "error" | "warning" | "unauthorized";
  message?: string;
  avatarChanged?: boolean;
  cleanupPending?: boolean;
};
export const initialAvatarState: AvatarActionState = { status: "idle" };
type StepResult = { errorCode?: string };
export type AvatarRepository = {
  plan(path: string): Promise<StepResult>;
  upload(path: string, bytes: Buffer): Promise<StepResult>;
  abort(path: string): Promise<StepResult>;
  commit(expectedUrl: string | null, newUrl: string | null, path: string | null):
    Promise<StepResult & { committed: boolean }>;
  cleanup(): Promise<boolean>;
};

export async function changeAvatar(
  repository: AvatarRepository,
  expectedUrl: string | null,
  upload: { path: string; url: string; buffer: Buffer } | null,
): Promise<AvatarActionState> {
  async function step(name: string, operation: () => Promise<StepResult>) {
    try {
      const result = await operation();
      if (!result.errorCode) return true;
      console.error("Avatar operation failed", { step: name, code: result.errorCode });
    } catch (error) {
      console.error("Avatar operation could not start", { step: name, ...getSafeCaughtErrorContext(error) });
    }
    return false;
  }
  async function discardUpload() {
    if (upload) await step("schedule_cleanup", () => repository.abort(upload.path));
    return cleanup();
  }
  async function cleanup() {
    try {
      return await repository.cleanup();
    } catch (error) {
      console.error("Avatar cleanup failed", getSafeCaughtErrorContext(error));
      return false;
    }
  }
  if (upload && !await step("plan", () => repository.plan(upload.path))) {
    return { status: "error", message: "No pudimos preparar la carga. Inténtalo de nuevo.", cleanupPending: true };
  }
  if (upload && !await step("upload", () => repository.upload(upload.path, upload.buffer))) {
    const clean = await discardUpload();
    return { status: "error", message: "No pudimos subir el avatar. Inténtalo de nuevo.", cleanupPending: !clean };
  }
  let committed = false;
  const confirmed = await step("commit", async () => {
    const result = await repository.commit(expectedUrl, upload?.url ?? null, upload?.path ?? null);
    committed = result.committed;
    return result;
  });
  if (!confirmed || !committed) {
    const clean = await discardUpload();
    return {
      status: "error",
      message: confirmed
        ? "Tu avatar cambió durante el guardado. Recarga el perfil antes de reintentar."
        : "No pudimos confirmar el guardado. Recarga el perfil antes de reintentar.",
      cleanupPending: !clean,
    };
  }
  const clean = await cleanup();
  return {
    status: clean ? "success" : "warning",
    message: clean
      ? (upload ? "Avatar actualizado." : "Avatar retirado.")
      : "El avatar se actualizó, pero hay limpieza pendiente. Reinténtala aquí.",
    avatarChanged: true,
    cleanupPending: !clean,
  };
}
