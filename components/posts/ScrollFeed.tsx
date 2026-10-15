"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { loadFeedPage } from "@/actions/post-feed";
import type { PostListResult } from "@/lib/posts/read-post.server";
import { FeedCard } from "./FeedCard";
import { usePostLikes } from "./PostLikes";

export function ScrollFeed({ initial }: { initial: Extract<PostListResult, { status: "ready" }> }) {
  const [posts, setPosts] = useState(initial.posts);
  const [cursor, setCursor] = useState(initial.nextCursor);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const likes = usePostLikes(posts.map((item) => item.post.id));
  const load = useCallback(async () => {
    if (!cursor || lock.current) return;
    lock.current = true; setPending(true); setFailed(false);
    try {
      const page = await loadFeedPage(cursor);
      if (page.status !== "ready") { setFailed(true); return; }
      setPosts((current) => {
        const seen = new Set(current.map((item) => item.post.id));
        return [...current, ...page.posts.filter((item) => !seen.has(item.post.id))];
      });
      setCursor(page.nextCursor);
    } catch (error) {
      console.error("Feed page failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
      setFailed(true);
    } finally {
      lock.current = false; setPending(false);
    }
  }, [cursor]);
  useEffect(() => {
    if (!cursor || failed || !sentinel.current) return;
    const observer = new IntersectionObserver(([entry]) => { if (entry.isIntersecting) void load(); }, { rootMargin: "400px" });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [cursor, failed, load]);
  return <>
    {posts.length === 0 ? <div className="posts-empty">
      <span className="posts-empty-mark" aria-hidden="true">✦</span>
      <h2>El comienzo de algo inspirador</h2>
      <p>Todavía no hay publicaciones. Comparte la primera imagen.</p>
      <Link className="button button-primary" href="/crear">Crear publicación</Link>
    </div> : <ul className="feed-stream" aria-label="Publicaciones">
      {posts.map((item) => <li key={item.post.id}><FeedCard item={item} likes={{
        entry: likes.rows[item.post.id], viewerKey: likes.viewerKey, update: likes.update, retry: likes.retry,
      }} /></li>)}
    </ul>}
    <div ref={sentinel} className="feed-load-more" aria-busy={pending}>
      <p role="status">{pending ? "Cargando más imágenes..." : failed ? "No pudimos cargar más publicaciones." : !cursor && posts.length > 0 ? "Estás al día. Vuelve pronto para inspirarte." : ""}</p>
      {cursor && <button className="button button-secondary" type="button" disabled={pending} onClick={load}>
        {failed ? "Reintentar carga" : "Cargar más publicaciones"}
      </button>}
    </div>
  </>;
}
