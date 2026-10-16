"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useEffect, useRef, useState, useTransition } from "react";
import { createCommentAction, deleteCommentAction, loadCommentViewer, loadPostComments } from "@/actions/post-comments";
import {
  COMMENT_MAX_LENGTH, commentInputSchema,
  type CommentActionResult, type CommentDeleteResult, type CommentReadResult, type CommentViewerResult, type PublicComment,
} from "@/lib/posts/comment-contract";

export function CommentList({ comments, viewerUsername, disabled = false, onDeleted, onBusy }: {
  comments: PublicComment[]; viewerUsername?: string; disabled?: boolean;
  onDeleted?: (result: CommentDeleteResult) => void; onBusy?: (busy: boolean) => void;
}) {
  return <ol className="post-comments-list" aria-label="Comentarios de la publicación">
    {comments.map((comment) => <li key={comment.id} id={`comment-${comment.id}`}>
      <article aria-label={`Comentario de ${comment.author_display_name}`}>
        <header>
          <Link href={`/usuario/${comment.author_username}`}>{comment.author_display_name} (@{comment.author_username})</Link>
          <time dateTime={comment.created_at}>{new Date(comment.created_at).toLocaleDateString("es")}</time>
        </header>
        <p>{comment.content}</p>
        {viewerUsername === comment.author_username && onDeleted && onBusy
          && <CommentDelete comment={comment} disabled={disabled} onDeleted={onDeleted} onBusy={onBusy} />}
      </article>
    </li>)}
  </ol>;
}

export function CommentDelete({ comment, disabled, onDeleted, onBusy }: {
  comment: PublicComment; disabled: boolean; onDeleted: (result: CommentDeleteResult) => void;
  onBusy: (busy: boolean) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const lock = useRef(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  function close() {
    dialog.current?.close();
    trigger.current?.focus();
  }
  function remove(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled) return;
    lock.current = true;
    onBusy(true);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await deleteCommentAction({ postId: comment.post_id, commentId: comment.id, confirmed: true });
        if (result.status === "success" || result.status === "missing") {
          dialog.current?.close();
          onDeleted(result);
        } else {
          setMessage(result.message);
          status.current?.focus();
        }
      } catch (error) {
        console.error("Comment deletion request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        setMessage("No pudimos confirmar la eliminación. Reintenta para comprobar el mismo comentario.");
        status.current?.focus();
      } finally {
        lock.current = false;
        onBusy(false);
      }
    });
  }
  return <>
    <button ref={trigger} type="button" className="button button-danger" disabled={disabled || pending}
      onClick={() => { setMessage(""); dialog.current?.showModal(); cancel.current?.focus(); }}>Eliminar comentario</button>
    <dialog ref={dialog} className="post-delete-dialog" aria-labelledby={`delete-comment-title-${comment.id}`}
      aria-describedby={`delete-comment-description-${comment.id}`}
      onCancel={(event) => { event.preventDefault(); if (!lock.current) close(); }}>
      <h2 id={`delete-comment-title-${comment.id}`}>¿Eliminar tu comentario?</h2>
      <p id={`delete-comment-description-${comment.id}`}>Esta acción no se puede deshacer. La lista se actualizará desde los comentarios más recientes.</p>
      <form onSubmit={remove} aria-busy={pending}>
        <p ref={status} className="form-status" role="status" tabIndex={-1}>{message}</p>
        <div className="profile-actions">
          <button ref={cancel} type="button" className="button button-secondary" disabled={pending} onClick={close} autoFocus>Cancelar</button>
          <button type="submit" className="button button-danger" disabled={pending}>{pending ? "Eliminando..." : "Confirmar eliminación"}</button>
        </div>
      </form>
    </dialog>
  </>;
}

function OwnedCommentList({ userId, comments, disabled, onDeleted, onBusy }: {
  userId: string; comments: PublicComment[]; disabled: boolean;
  onDeleted: (result: CommentDeleteResult) => void; onBusy: (busy: boolean) => void;
}) {
  const [viewer, setViewer] = useState<CommentViewerResult | null>(null);
  const [revision, setRevision] = useState(0);
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    let active = true;
    startTransition(async () => {
      try {
        const next = await loadCommentViewer();
        if (active) setViewer(next);
      } catch (error) {
        console.error("Comment permissions request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        if (active) setViewer({ status: "error", message: "No pudimos verificar tus permisos de comentarios. Vuelve a intentarlo." });
      }
    });
    return () => { active = false; };
  }, [userId, revision]);
  return <>
    <CommentList comments={comments} viewerUsername={viewer?.status === "ready" && viewer.userId === userId ? viewer.username : undefined}
      disabled={disabled || pending} onDeleted={onDeleted} onBusy={onBusy} />
    {viewer && viewer.status !== "ready" && <p className="form-status" role="status">{viewer.message}</p>}
    {viewer?.status === "error" && <button type="button" className="button button-secondary" disabled={pending}
      onClick={() => setRevision((value) => value + 1)}>Reintentar permisos de comentarios</button>}
  </>;
}

export function CommentComposer({ postId, onCreated, disabled = false }: {
  postId: string; onCreated: (result: Extract<CommentActionResult, { status: "success" }>) => void; disabled?: boolean;
}) {
  const [content, setContent] = useState("");
  const [message, setMessage] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [profileRequired, setProfileRequired] = useState(false);
  const [pending, startTransition] = useTransition();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const operation = useRef<{ id: string; content: string } | null>(null);
  const lock = useRef(false);
  function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current || disabled) return;
    const draft = content.trim();
    const operationId = operation.current?.content === draft ? operation.current.id : crypto.randomUUID();
    const parsed = commentInputSchema.safeParse({ postId, content, operationId });
    if (!parsed.success) {
      setInvalid(true);
      setMessage("Escribe de 1 a 1000 caracteres de texto válido.");
      textarea.current?.focus();
      return;
    }
    operation.current = { id: operationId, content: parsed.data.content };
    lock.current = true;
    setInvalid(false);
    setProfileRequired(false);
    setMessage("");
    startTransition(async () => {
      try {
        const result = await createCommentAction(parsed.data);
        if (result.status === "success") {
          onCreated(result);
          setContent("");
          operation.current = null;
          setMessage("Comentario publicado.");
        } else {
          setInvalid(result.status === "invalid");
          setProfileRequired(result.status === "profile-required");
          setMessage(result.message);
        }
      } catch (error) {
        console.error("Comment request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        setMessage("No pudimos confirmar el comentario. Reintenta sin cambiar el texto para confirmar el mismo envío.");
      } finally {
        lock.current = false;
      }
    });
  }
  return <form className="profile-form comment-form" onSubmit={submit} noValidate aria-busy={pending}>
    <div className="form-field">
      <label htmlFor={`comment-content-${postId}`}>Escribe un comentario</label>
      <textarea ref={textarea} id={`comment-content-${postId}`} name="content" rows={3} required
        value={content} disabled={pending || disabled} onChange={(event) => setContent(event.target.value)}
        aria-invalid={invalid} aria-describedby={`comment-help-${postId} comment-message-${postId}`} />
      <p className="field-help" id={`comment-help-${postId}`}>
        Texto plano, de 1 a {COMMENT_MAX_LENGTH} caracteres. {[...content.trim()].length}/{COMMENT_MAX_LENGTH}
      </p>
    </div>
    <button className="button button-primary" type="submit" disabled={pending || disabled}>
      {pending ? "Enviando comentario..." : "Publicar comentario"}
    </button>
    <p className="form-status" id={`comment-message-${postId}`} role="status">{message}</p>
    {profileRequired && <Link href="/perfil">Completar mi perfil</Link>}
  </form>;
}

export function PostComments({ postId, initial }: { postId: string; initial: CommentReadResult }) {
  const { isLoaded, userId } = useAuth();
  const [result, setResult] = useState(initial);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [deleting, setDeleting] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const [pending, startTransition] = useTransition();
  const lock = useRef(false);
  const request = useRef(0);
  const lastAppend = useRef(false);
  function load(append: boolean) {
    if (lock.current) return;
    lock.current = true;
    lastAppend.current = append;
    const currentRequest = ++request.current;
    const cursor = append && result.status === "ready" ? result.page.nextCursor ?? undefined : undefined;
    setError("");
    startTransition(async () => {
      try {
        const next = await loadPostComments(postId, cursor);
        if (currentRequest !== request.current) return;
        if (next.status === "unavailable") {
          setError("No pudimos cargar los comentarios. Vuelve a intentarlo.");
          return;
        }
        setResult((current) => {
          if (next.status !== "ready" || !append || current.status !== "ready") return next;
          const known = new Set(current.page.comments.map((comment) => comment.id));
          return { status: "ready", page: { ...next.page,
            comments: [...current.page.comments, ...next.page.comments.filter((comment) => !known.has(comment.id))] } };
        });
      } catch (caught) {
        console.error("Comment page request failed", { errorType: caught instanceof Error ? caught.name : "UnknownError" });
        if (currentRequest === request.current) setError("No pudimos cargar los comentarios. Vuelve a intentarlo.");
      } finally {
        lock.current = false;
      }
    });
  }
  function created(comment: Extract<CommentActionResult, { status: "success" }>) {
    request.current++;
    setResult((current) => current.status !== "ready" ? current : {
      status: "ready", page: { ...current.page, commentCount: comment.commentCount,
        comments: [comment.comment, ...current.page.comments.filter((row) => row.id !== comment.comment.id)] },
    });
  }
  function deletionBusy(busy: boolean) {
    if (busy) request.current++;
    lock.current = busy;
    setDeleting(busy);
  }
  function deleted(next: CommentDeleteResult) {
    request.current++;
    lastAppend.current = false;
    setError("");
    if (next.status === "success") {
      setResult({ status: "ready", page: next.page });
      setNotice("Comentario eliminado. Se muestran los comentarios más recientes.");
    } else if (next.status === "missing") {
      setResult({ status: "missing" });
      setNotice(next.message);
    }
    heading.current?.focus();
  }
  return <section id="comentarios" className="post-comments" aria-labelledby={`comments-title-${postId}`} aria-busy={pending || deleting}>
    <h2 ref={heading} tabIndex={-1} id={`comments-title-${postId}`}>
      Comentarios{result.status === "ready" ? ` (${result.page.commentCount})` : ""}
    </h2>
    {result.status === "missing" ? <p role="status">La publicación ya no está disponible.</p>
      : result.status === "unavailable" ? <p role="status">No pudimos cargar los comentarios.</p>
      : <>
        {isLoaded && (userId
          ? <CommentComposer key={`composer-${userId}`} postId={postId} onCreated={created} disabled={deleting} />
          : <p><Link href={`/sign-in?redirect_url=${encodeURIComponent(`/post/${postId}#comentarios`)}`}>
            Inicia sesión para comentar
          </Link></p>)}
        {result.page.comments.length ? isLoaded && userId
          ? <OwnedCommentList key={`comments-${userId}`} userId={userId} comments={result.page.comments}
            disabled={pending || deleting} onDeleted={deleted} onBusy={deletionBusy} />
          : <CommentList comments={result.page.comments} />
          : <p className="form-status">Todavía no hay comentarios.</p>}
        {result.page.nextCursor && <button className="button button-secondary" type="button" disabled={pending || deleting}
          onClick={() => load(true)}>Ver comentarios anteriores</button>}
      </>}
    {error && <p className="form-status" role="status">{error}</p>}
    {notice && <p className="form-status" role="status">{notice}</p>}
    {result.status !== "missing" && <button className="button button-secondary" type="button" disabled={pending || deleting}
      onClick={() => load(error ? lastAppend.current : false)}>{result.status === "unavailable" || error ? "Reintentar comentarios" : "Actualizar comentarios"}</button>}
  </section>;
}
