"use client";

import { useRef, useState, useTransition } from "react";
import { copyPostLink, getPostShareLink, sharePostLink } from "@/lib/posts/share-contract";

export function PostShare({ postId }: { postId: string }) {
  const link = getPostShareLink(postId);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const copy = useRef<HTMLButtonElement>(null);
  const lock = useRef(false);
  const [nativeSupported, setNativeSupported] = useState(false);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  function open() {
    setNativeSupported(typeof navigator.share === "function");
    setMessage("");
    dialog.current?.showModal();
    copy.current?.focus();
  }
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  function perform(kind: "copy" | "native") {
    if (lock.current || link.status !== "ready") return;
    lock.current = true;
    setMessage("");
    startTransition(async () => {
      try {
        const result = kind === "copy" ? await copyPostLink(link.url, navigator.clipboard)
          : await sharePostLink(link.url, typeof navigator.share === "function" ? navigator.share.bind(navigator) : undefined);
        setMessage(result.message);
        if (kind === "copy" && result.status !== "copied") {
          input.current?.focus();
          input.current?.select();
        }
      } catch (error) {
        console.error("Post share request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        setMessage("No pudimos completar la acción. Selecciona el enlace y cópialo manualmente.");
        input.current?.focus();
        input.current?.select();
      } finally {
        lock.current = false;
      }
    });
  }
  if (link.status !== "ready") {
    return <div className="post-share">
      <button className="button button-secondary share-button" type="button" disabled>Compartir</button>
      <p className="field-help" role="status">{link.message}</p>
    </div>;
  }
  return <div className="post-share">
    <button ref={trigger} className="button button-secondary share-button" type="button" onClick={open}>Compartir</button>
    <dialog ref={dialog} className="post-share-dialog" aria-labelledby={`share-title-${postId}`}
      aria-describedby={`share-help-${postId}`}
      onCancel={(event) => { event.preventDefault(); if (!lock.current) close(); }}>
      <h2 id={`share-title-${postId}`}>Compartir publicación</h2>
      <p id={`share-help-${postId}`}>Este enlace abre la publicación pública mientras esté disponible.</p>
      <div className="form-field">
        <label htmlFor={`share-link-${postId}`}>Enlace público</label>
        <input ref={input} id={`share-link-${postId}`} type="url" readOnly value={link.url}
          onFocus={(event) => event.currentTarget.select()} />
        <p className="field-help">También puedes seleccionar el enlace y copiarlo manualmente.</p>
      </div>
      <div className="profile-actions" aria-busy={pending}>
        <button ref={copy} className="button button-primary" type="button" disabled={pending}
          onClick={() => perform("copy")}>Copiar enlace</button>
        {nativeSupported && <button className="button button-secondary" type="button" disabled={pending}
          onClick={() => perform("native")}>Compartir con otra aplicación</button>}
        <button className="button button-secondary" type="button" disabled={pending} onClick={close}>Cerrar</button>
      </div>
      {!nativeSupported && <p className="field-help">Este navegador no ofrece compartir nativo. Puedes copiar el enlace.</p>}
      <p className="form-status" role="status">{message}</p>
    </dialog>
  </div>;
}
