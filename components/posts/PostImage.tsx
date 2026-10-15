"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { refreshPostImage } from "@/actions/post-feed";

export function PostImage({ id, title, initialUrl, sizes }: {
  id: string; title: string; initialUrl: string | null; sizes: string;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [failed, setFailed] = useState(false);
  const retried = useRef(false);
  async function recover() {
    if (retried.current) { setFailed(true); return; }
    retried.current = true;
    try {
      const fresh = await refreshPostImage(id);
      if (!fresh || fresh === url) { setFailed(true); return; }
      setUrl(fresh);
    } catch (error) {
      console.error("Post image refresh failed", { errorType: error instanceof Error ? error.name : "UnknownError" });
      setFailed(true);
    }
  }
  return <div className="post-image-frame">
    {url && !failed ? <Image src={url} alt={title} fill unoptimized sizes={sizes} onError={recover} />
      : <span className="post-image-unavailable">Imagen no disponible</span>}
    {failed && <span className="post-image-retry">Abre el detalle para reintentar</span>}
  </div>;
}
