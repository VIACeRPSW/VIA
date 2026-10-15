import type { PostActionState, PostInput } from "@/lib/posts/post-contract";
import { getSafeCaughtErrorContext } from "@/lib/supabase/profile-status";

export type BeginPostResult =
  | { status: "ready"; image_path: string }
  | { status: "published"; post_id: string }
  | { status: "busy" }
  | { status: "conflict" }
  | { status: "cleanup" };
export type PostRepository = {
  begin(input: PostInput, digest: string, lease: string): Promise<BeginPostResult>;
  upload(path: string, bytes: Buffer): Promise<void>;
  commit(operation: string, lease: string): Promise<string>;
  abort(operation: string, lease: string): Promise<void>;
  cleanup(): Promise<boolean>;
};

export async function publishPost(
  input: PostInput, bytes: Buffer, digest: string, lease: string, repository: PostRepository,
): Promise<PostActionState> {
  try {
    const planned = await repository.begin(input, digest, lease);
    if (planned.status === "published") return { status: "success", postId: planned.post_id };
    if (planned.status === "busy") {
      return { status: "busy", message: "Hay una carga en curso. Espera y vuelve a publicar; si se interrumpió, limpia los pendientes tras 10 minutos.", cleanupPending: true };
    }
    if (planned.status === "conflict") {
      return { status: "conflict", message: "Esta operación ya utiliza otros datos. Recarga el formulario para crear otra publicación." };
    }
    if (planned.status === "cleanup") {
      return { status: "error", message: "Limpia la carga pendiente antes de reintentar.", cleanupPending: true };
    }
    await repository.upload(planned.image_path, bytes);
    const postId = await repository.commit(input.operationId, lease);
    return { status: "success", postId };
  } catch (error) {
    console.error("Post publishing failed", getSafeCaughtErrorContext(error));
    try {
      const recovered = await repository.begin(input, digest, lease);
      if (recovered.status === "published") return { status: "success", postId: recovered.post_id };
      await repository.abort(input.operationId, lease);
    } catch (recoveryError) {
      console.error("Post publishing recovery failed", getSafeCaughtErrorContext(recoveryError));
    }
    let clean = false;
    try {
      clean = await repository.cleanup();
    } catch (cleanupError) {
      console.error("Post publishing cleanup failed", getSafeCaughtErrorContext(cleanupError));
    }
    return {
      status: "error", message: "No pudimos confirmar la publicación. Reintenta con este formulario para recuperar la misma operación.",
      cleanupPending: !clean,
    };
  }
}
