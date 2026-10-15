"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { cleanupPostUploadsAction, deletePostAndRedirectAction } from "@/actions/posts";
import { initialPostState } from "@/lib/posts/post-contract";

export function PostManagement({ id, version }: { id: string; version: number }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const [state, action, pending] = useActionState(deletePostAndRedirectAction, initialPostState);
  useEffect(() => {
    if (state.message) status.current?.focus();
  }, [state]);
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  return <div className="post-management">
    <span>Esta publicación es tuya</span>
    <Link className="button button-secondary" href={`/post/${id}/editar`}>Editar publicación</Link>
    <button ref={trigger} className="button button-danger" type="button" onClick={() => dialog.current?.showModal()}>
      Eliminar publicación
    </button>
    <dialog ref={dialog} className="post-delete-dialog" aria-labelledby="delete-post-title"
      aria-describedby="delete-post-description" onCancel={(event) => { if (pending) event.preventDefault(); }}>
      <h2 id="delete-post-title">¿Eliminar esta publicación?</h2>
      <p id="delete-post-description">Desaparecerá del feed y de tu galería. Se eliminará su imagen almacenada. Esta acción no se puede deshacer.</p>
      <p className="field-help">Las copias descargadas no se pueden retirar. Un enlace de imagen ya firmado puede seguir válido hasta 60 segundos.</p>
      <form action={action}>
        <input type="hidden" name="postId" value={id} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="confirmed" value="yes" />
        {state.message && <p ref={status} tabIndex={-1} className="form-status" role="status">{state.message}</p>}
        {state.status === "unauthorized" && <Link href="/sign-in">Volver a iniciar sesión</Link>}
        <div className="profile-actions">
          <button className="button button-secondary" type="button" disabled={pending} onClick={close} autoFocus>Cancelar</button>
          <button className="button button-danger" type="submit" disabled={pending}>{pending ? "Eliminando..." : "Confirmar eliminación"}</button>
        </div>
      </form>
    </dialog>
  </div>;
}

export function PostCleanupButton() {
  const [state, action, pending] = useActionState(cleanupPostUploadsAction, initialPostState);
  return <form action={action} className="post-cleanup">
    <p className="field-help">Si una carga o un borrado se interrumpió, puedes limpiar tus imágenes pendientes. Una carga activa caduca tras 10 minutos.</p>
    {state.message && <p className="form-status" role="status">{state.message}</p>}
    <button className="button button-secondary" type="submit" disabled={pending}>{pending ? "Limpiando..." : "Limpiar imágenes pendientes"}</button>
  </form>;
}
