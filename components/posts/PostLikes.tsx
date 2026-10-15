"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadPostLikes, setPostLike } from "@/actions/post-likes";
import type { PostLike } from "@/lib/posts/like-contract";

export type LikeEntry =
  | { status: "ready"; like: PostLike }
  | { status: "missing" }
  | { status: "unavailable" };
type LikeSnapshot = { actor: string | null; rows: Record<string, LikeEntry> };

export function usePostLikes(postIds: string[]) {
  const { isLoaded, userId } = useAuth();
  const actor = userId ?? null;
  const idsKey = postIds.join(",");
  const [snapshot, setSnapshot] = useState<LikeSnapshot>({ actor: null, rows: {} });
  const cache = useRef<LikeSnapshot>({ actor: null, rows: {} });
  const revisions = useRef<Record<string, number>>({});
  const reload = useRef<() => void>(() => {});

  useEffect(() => {
    if (!isLoaded) return;
    let active = true;
    let request = 0;
    if (cache.current.actor !== actor) {
      cache.current = { actor, rows: {} };
      revisions.current = {};
    }
    async function load(force: boolean) {
      const currentRequest = ++request;
      const ids = idsKey.split(",").filter((id) => id && (force || !cache.current.rows[id]));
      for (let offset = 0; offset < ids.length; offset += 12) {
        const batch = ids.slice(offset, offset + 12);
        const versions = batch.map((id) => revisions.current[id] ?? 0);
        try {
          const result = await loadPostLikes(batch);
          if (!active || currentRequest !== request) return;
          const rows = { ...cache.current.rows };
          batch.forEach((id, index) => {
            if (versions[index] !== (revisions.current[id] ?? 0)) return;
            const like = result.status === "ready" ? result.likes.find((row) => row.post_id === id) : undefined;
            rows[id] = result.status !== "ready" ? { status: "unavailable" }
              : like ? { status: "ready", like } : { status: "missing" };
          });
          cache.current = { actor, rows };
          setSnapshot(cache.current);
        } catch (error) {
          console.error("Post likes request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
          if (!active || currentRequest !== request) return;
          const rows = { ...cache.current.rows };
          batch.forEach((id, index) => {
            if (versions[index] === (revisions.current[id] ?? 0)) rows[id] = { status: "unavailable" };
          });
          cache.current = { actor, rows };
          setSnapshot(cache.current);
        }
      }
    }
    const refresh = () => { void load(true); };
    const visible = () => { if (document.visibilityState === "visible") refresh(); };
    reload.current = refresh;
    void load(false);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", visible);
    return () => {
      active = false;
      reload.current = () => {};
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [actor, idsKey, isLoaded]);

  const update = useCallback((like: PostLike) => {
    if (cache.current.actor !== actor) return;
    revisions.current[like.post_id] = (revisions.current[like.post_id] ?? 0) + 1;
    cache.current = { actor, rows: { ...cache.current.rows, [like.post_id]: { status: "ready", like } } };
    setSnapshot(cache.current);
  }, [actor]);

  return {
    rows: isLoaded && snapshot.actor === actor ? snapshot.rows : {},
    viewerKey: isLoaded ? actor ?? "anonymous" : "loading",
    update,
    retry: () => reload.current(),
  };
}

export function LikeButton({ postId, entry, onChange, retry }: {
  postId: string; entry?: LikeEntry; onChange: (like: PostLike) => void; retry: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const lock = useRef(false);
  if (!entry) return <span className="post-like-status" role="status">Cargando me gusta...</span>;
  if (entry.status === "unavailable") return <span className="post-like-status" role="status">
    No pudimos cargar los me gusta. <button type="button" className="post-like-button" onClick={retry}>Reintentar likes</button>
  </span>;
  if (entry.status === "missing") return <span className="post-like-status" role="status">Publicación no disponible.</span>;
  const { like } = entry;
  if (!like.can_like) return <div className="post-like-controls">
    <span>{like.like_count} me gusta</span>
    <Link href={like.liked === null ? `/sign-in?redirect_url=${encodeURIComponent(`/post/${postId}`)}` : "/perfil"}>
      {like.liked === null ? "Inicia sesión para dar me gusta" : "Completa tu perfil para dar me gusta"}
    </Link>
  </div>;
  function change() {
    if (lock.current) return;
    lock.current = true;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await setPostLike({ postId, liked: !like.liked });
        if (result.status === "success") {
          onChange(result.like);
          setMessage(result.like.liked ? "Me gusta guardado." : "Me gusta retirado.");
        } else setMessage(result.message);
      } catch (error) {
        console.error("Post like request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        setMessage("No pudimos confirmar el cambio. Vuelve a intentarlo.");
      } finally {
        lock.current = false;
      }
    });
  }
  return <div className="post-like-controls">
    <button type="button" className="post-like-button" aria-pressed={like.liked ?? false}
      aria-label={like.liked ? "Quitar me gusta" : "Dar me gusta"} disabled={pending} onClick={change}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />
      </svg>
      <span>{pending ? "Guardando..." : "Me gusta"}</span>
      <span aria-label={`${like.like_count} me gusta`}>{like.like_count}</span>
    </button>
    <span className="post-like-status" role="status">{message}</span>
  </div>;
}

export function PostLikes({ postId }: { postId: string }) {
  const likes = usePostLikes([postId]);
  return <LikeButton key={likes.viewerKey} postId={postId} entry={likes.rows[postId]}
    onChange={likes.update} retry={likes.retry} />;
}
