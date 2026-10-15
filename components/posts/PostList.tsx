import Link from "next/link";
import type { PostListResult } from "@/lib/posts/read-post.server";
import { PostImage } from "./PostImage";

export function PostList({ result, basePath, paginated = false }: {
  result: PostListResult; basePath: string; paginated?: boolean;
}) {
  if (result.status === "unavailable") return <p className="form-status" role="status">
    No pudimos cargar las publicaciones. <Link href={basePath} prefetch={false}>Volver a intentar</Link>
  </p>;
  const next = result.nextCursor;
  return <>
    {result.posts.length === 0 ? <p className="form-status" role="status">
      {paginated ? "No hay más publicaciones." : "Todavía no hay publicaciones."}
    </p> : <ul className="post-grid" aria-label="Publicaciones">
      {result.posts.map(({ post, imageUrl }) => <li key={post.id} className="gallery-tile">
        <Link href={`/post/${post.id}`} className="post-card-image" aria-label={`Ver publicación: ${post.title}`} prefetch={false}>
          <PostImage key={imageUrl} id={post.id} title={post.title} initialUrl={imageUrl} sizes="(max-width: 768px) 33vw, 320px" />
          <span className="gallery-tile-open" aria-hidden="true">↗</span>
        </Link>
      </li>)}
    </ul>}
    <nav className="profile-actions post-pagination" aria-label="Paginación de publicaciones">
      {paginated && <Link className="button button-secondary" href={basePath} prefetch={false}>Volver a las recientes</Link>}
      {next && <Link className="button button-secondary" prefetch={false}
        href={`${basePath}?${new URLSearchParams(next)}`}>Ver anteriores</Link>}
    </nav>
  </>;
}
