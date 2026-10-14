"use client";

import Image from "next/image";
import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import { avatarAction } from "@/actions/avatars";
import { initialAvatarState } from "@/lib/profiles/avatar-operation";
import { AVATAR_MAX_BYTES, AVATAR_MIME_TYPES } from "@/lib/profiles/avatar-path";

export function AvatarEditor({
  avatarUrl, cleanupPending, cleanupUnavailable,
}: {
  avatarUrl: string | null;
  cleanupPending: boolean;
  cleanupUnavailable: boolean;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);
  const [state, action, pending] = useActionState(async (
    previousState: typeof initialAvatarState, data: FormData,
  ) => {
    if (data.get("operation") === "upload" && file) data.set("avatar", file);
    try {
      const result = await avatarAction(previousState, data);
      if (result.avatarChanged) {
        setFile(null);
        setPreview(null);
        if (fileRef.current) fileRef.current.value = "";
      }
      return result;
    } catch (error) {
      console.error("Avatar request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
      return { status: "error" as const, message: "No pudimos enviar la imagen. Inténtalo de nuevo." };
    }
  }, initialAvatarState);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  useEffect(() => {
    if (state.status !== "idle") statusRef.current?.focus();
  }, [state]);

  return (
    <section className="avatar-editor" aria-labelledby="avatar-title">
      <h2 id="avatar-title">Avatar</h2>
      {preview ? (
        // Object URLs are local previews and must not pass through the optimizer.
        // eslint-disable-next-line @next/next/no-img-element
        <img className="profile-avatar" src={preview} alt="Previsualización del nuevo avatar" width={96} height={96} />
      ) : avatarUrl ? (
        <Image className="profile-avatar" src={avatarUrl} alt="Tu avatar actual" width={96} height={96} sizes="96px" />
      ) : <p>Sin avatar.</p>}
      <form className="profile-form" action={action} aria-busy={pending}>
        <div className="form-field">
          <label htmlFor="avatar">Imagen de avatar</label>
          <input
            ref={fileRef} id="avatar" name="avatar" type="file" disabled={pending}
            accept={AVATAR_MIME_TYPES.join(",")} aria-describedby="avatar-help"
            onChange={(event) => {
              const selected = event.target.files?.[0] ?? null;
              setFile(selected);
              setPreview(selected && selected.size <= AVATAR_MAX_BYTES
                && AVATAR_MIME_TYPES.includes(selected.type) ? URL.createObjectURL(selected) : null);
            }}
          />
          <p id="avatar-help" className="field-help">
            JPEG, PNG o WebP, hasta 2 MiB y 4096 píxeles por lado. Se guarda en WebP, hasta 512 píxeles, sin metadatos.
          </p>
        </div>
        {(cleanupPending || cleanupUnavailable) && (
          <p className="form-status">
            {cleanupUnavailable ? "No pudimos comprobar la limpieza."
              : "Hay archivos pendientes de limpieza. Las cargas interrumpidas pueden limpiarse tras 10 minutos."}
          </p>
        )}
        {(pending || state.message) && (
          <p ref={statusRef} className="form-status" role="status" tabIndex={-1}>
            {pending ? "Procesando avatar..." : state.message}
          </p>
        )}
        {state.status === "unauthorized" && <Link href="/sign-in">Volver a iniciar sesión</Link>}
        <div className="profile-actions">
          <button className="button button-primary" type="submit" name="operation" value="upload" disabled={pending || !file}>
            {avatarUrl ? "Reemplazar avatar" : "Subir avatar"}
          </button>
          <button className="button button-secondary" type="submit" name="operation" value="remove" disabled={pending || !avatarUrl}>
            Retirar avatar
          </button>
          {(cleanupPending || cleanupUnavailable || state.cleanupPending) && (
            <button className="button button-secondary" type="submit" name="operation" value="cleanup" disabled={pending}>
              Reintentar limpieza
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
