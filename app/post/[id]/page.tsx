import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { getPublicPost } from "@/lib/posts/read-post.server";

export default async function PostPage({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  const result = await getPublicPost(id);
  if (result.status === "missing") notFound();
  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link className="brand" href="/" aria-label="VIA, volver al inicio">VIA</Link>
        <nav className="profile-actions" aria-label="Publicaciones">
          <Link className="button button-primary" href="/crear">Crear publicación</Link>
          <Link className="button button-secondary" href="/perfil">Mi perfil</Link>
        </nav>
      </header>
      {result.status === "found" ? <article className="post-detail" aria-labelledby="post-title">
        <p className="eyebrow">{result.post.category_name}</p>
        <h1 id="post-title">{result.post.title}</h1>
        <p>Por <Link href={`/usuario/${result.post.author_username}`}>
          {result.post.author_display_name} (@{result.post.author_username})
        </Link></p>
        {result.imageUrl ? <div className="post-image-frame">
          <Image src={result.imageUrl} alt={result.post.title} fill unoptimized sizes="(max-width: 768px) 100vw, 768px" />
        </div> : <p className="form-status" role="status">
          No pudimos cargar la imagen. <Link href={`/post/${id}`}>Volver a intentar</Link>
        </p>}
        {result.post.description && <p className="post-description">{result.post.description}</p>}
        <ul className="post-hashtags" aria-label="Hashtags">
          {result.post.hashtags.map((tag) => <li key={tag}>#{tag}</li>)}
        </ul>
        <time dateTime={result.post.created_at}>{new Date(result.post.created_at).toLocaleDateString("es")}</time>
      </article> : <section className="profile-form-panel">
        <h1>Publicación no disponible</h1>
        <p className="form-status" role="status">No pudimos cargar la publicación. Inténtalo de nuevo más tarde.</p>
      </section>}
    </main>
  );
}
