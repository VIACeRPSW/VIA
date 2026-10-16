"use client";

import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { loadProfileFollows, setProfileFollow } from "@/actions/profile-follows";
import type { FollowReadResult, FollowSummary } from "@/lib/profiles/follow-contract";

export function FollowControls({ summary, disabled, onConfirmed, onMissing }: {
  summary: FollowSummary; disabled: boolean; onConfirmed: (summary: FollowSummary) => void; onMissing: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [retrying, setRetrying] = useState(false);
  const intent = useRef<boolean | null>(null);
  const lock = useRef(false);
  if (summary.viewer === "self") return <p className="field-help">Este es tu perfil.</p>;
  if (summary.viewer === "profile-required") return <Link href="/perfil">Completa tu perfil para seguir autores</Link>;
  if (summary.viewer === "anonymous" || summary.viewer === "expired") {
    return <Link href={`/sign-in?redirect_url=${encodeURIComponent(`/usuario/${summary.username}`)}`}>
      {summary.viewer === "expired" ? "Vuelve a iniciar sesión para seguir" : "Inicia sesión para seguir"}
    </Link>;
  }
  function change() {
    if (lock.current || disabled) return;
    lock.current = true;
    const desired = intent.current ?? !summary.following;
    intent.current = desired;
    setMessage("");
    startTransition(async () => {
      try {
        const result = await setProfileFollow({ profileId: summary.profile_id, following: desired });
        if (result.status === "success") {
          intent.current = null;
          setRetrying(false);
          onConfirmed(result.summary);
          setMessage(result.summary.following ? "Ahora sigues a este autor." : "Has dejado de seguir a este autor.");
        } else {
          setRetrying(true);
          setMessage(result.message);
          if (result.status === "missing") onMissing();
        }
      } catch (error) {
        console.error("Follow request failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
        setMessage("No pudimos confirmar el cambio. Reintenta para confirmar el mismo estado.");
        setRetrying(true);
      } finally {
        lock.current = false;
      }
    });
  }
  return <div className="profile-follow-controls">
    <button type="button" className="button button-primary" aria-pressed={summary.following ?? false}
      disabled={pending || disabled} onClick={change}>
      {pending ? "Guardando seguimiento..." : retrying ? "Reintentar seguimiento"
        : summary.following ? "Dejar de seguir" : "Seguir"}
    </button>
    <p className="form-status" role="status">{message}</p>
  </div>;
}

function FollowPanel({ username, initial, actorKey, loaded }: {
  username: string; initial: FollowReadResult; actorKey: string | null; loaded: boolean;
}) {
  const [result, setResult] = useState(initial);
  const [personal, setPersonal] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const target = useRef(initial.status === "ready" ? initial.summary.profile_id : null);
  const request = useRef(0);
  const alive = useRef(false);
  const reload = useCallback(() => {
    const current = ++request.current;
    startTransition(async () => {
      try {
        const next = await loadProfileFollows(target.current ? { profileId: target.current } : { username });
        if (!alive.current || current !== request.current) return;
        if (next.actorKey !== actorKey || next.status === "unavailable") {
          setError("No pudimos actualizar el seguimiento. Vuelve a intentarlo.");
          if (next.actorKey !== actorKey) setPersonal(false);
          return;
        }
        if (next.status === "ready") target.current = next.summary.profile_id;
        setResult(next);
        setPersonal(true);
        setError("");
      } catch (caught) {
        console.error("Follow summary request failed", { errorType: caught instanceof Error ? caught.name : "UnknownError" });
        if (alive.current && current === request.current) {
          setError("No pudimos actualizar el seguimiento. Vuelve a intentarlo.");
        }
      }
    });
  }, [actorKey, username]);
  useEffect(() => {
    if (!loaded) return;
    alive.current = true;
    const visible = () => { if (document.visibilityState === "visible") reload(); };
    reload();
    window.addEventListener("focus", reload);
    document.addEventListener("visibilitychange", visible);
    return () => {
      alive.current = false;
      window.removeEventListener("focus", reload);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [loaded, reload]);
  function confirmed(summary: FollowSummary) {
    request.current++;
    setResult({ status: "ready", summary });
    setPersonal(true);
    setError("");
  }
  return <section className="profile-follows" aria-label="Seguimiento del perfil" aria-busy={pending}>
    {result.status === "ready" ? <>
      <dl className="profile-follow-counts" aria-label="Seguidores y seguidos">
        <div><dt>Seguidores</dt><dd>{result.summary.follower_count}</dd></div>
        <div><dt>Seguidos</dt><dd>{result.summary.following_count}</dd></div>
      </dl>
      {result.summary.username !== username && <p className="field-help">
        Este perfil ahora es <Link href={`/usuario/${result.summary.username}`}>@{result.summary.username}</Link>.
      </p>}
      {!loaded || (!personal && actorKey !== null && !error) ? <p role="status">Cargando seguimiento...</p>
        : (personal || actorKey === null) && <FollowControls summary={result.summary} disabled={pending || Boolean(error)}
          onConfirmed={confirmed} onMissing={() => { request.current++; setResult({ status: "missing" }); }} />}
    </> : <p role="status">{result.status === "missing" ? "Este perfil ya no está disponible." : "No pudimos cargar los conteos de seguimiento."}</p>}
    {error && <p className="form-status" role="status">{error}</p>}
    {result.status !== "missing" && <button type="button" className="button button-secondary" disabled={!loaded || pending}
      onClick={reload}>{error || result.status === "unavailable" ? "Reintentar seguimiento" : "Actualizar seguimiento"}</button>}
  </section>;
}

export function ProfileFollows({ username, initial }: { username: string; initial: FollowReadResult }) {
  const { isLoaded, userId } = useAuth();
  const targetKey = initial.status === "ready" ? initial.summary.profile_id : username;
  return <FollowPanel key={`${targetKey}:${isLoaded ? userId ?? "anonymous" : "loading"}`}
    username={username} initial={initial} actorKey={userId ?? null} loaded={isLoaded} />;
}
