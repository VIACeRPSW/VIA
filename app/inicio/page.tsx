import Link from "next/link";
import { connection } from "next/server";
import { ScrollFeed } from "@/components/posts/ScrollFeed";
import { getPublicFeed } from "@/lib/posts/read-post.server";
import { parsePostCursor, type PostSearchParams } from "@/lib/posts/post-cursor";

export default async function FeedPage({ searchParams }: { searchParams: Promise<PostSearchParams> }) {
  await connection();
  const parsed = parsePostCursor(await searchParams);
  const result = parsed.valid ? await getPublicFeed(parsed.cursor) : null;
  return <main className="profile-page social-page">
    <header className="profile-header social-header">
      <Link className="brand" href="/">VIA</Link>
      <nav className="profile-actions" aria-label="Publicaciones">
        <Link className="button button-primary" href="/crear">Crear publicación</Link>
        <Link className="button button-secondary" href="/imagenes">Mi galería</Link>
        <Link href="/perfil">Mi perfil</Link>
      </nav>
    </header>
    <section className="feed-layout" aria-labelledby="feed-title">
      <div className="feed-intro">
      <p className="eyebrow">Tu dosis de inspiración</p>
      <h1 id="feed-title" className="post-list-title">Publicaciones recientes</h1>
      <p>Una imagen. Una idea. Otra forma de aprender.</p>
      </div>
      {result?.status === "ready"
        ? <ScrollFeed key={result.posts.map((item) => `${item.post.id}:${item.post.updated_at}:${item.commentCount}`).join(",")} initial={result} />
        : <p className="form-status" role="status">
          {result ? "No pudimos cargar las publicaciones." : "El enlace de paginación no es válido."} <Link href="/inicio">Volver a intentar</Link>
        </p>}
    </section>
  </main>;
}
