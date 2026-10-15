import Link from "next/link";
import { PostList } from "@/components/posts/PostList";
import { getOwnPostCount, getPublicPosts } from "@/lib/posts/read-post.server";
import { getProfileForRoute } from "@/lib/profiles/profile-route.server";
import { parsePostCursor, type PostSearchParams } from "@/lib/posts/post-cursor";
import { PostCleanupButton } from "@/components/posts/PostManagement";

export default async function GalleryPage({ searchParams }: { searchParams: Promise<PostSearchParams> }) {
  const profile = await getProfileForRoute("existing");
  const query = await searchParams;
  const parsed = parsePostCursor(query);
  const [result, count] = profile.status === "found" && parsed.valid
    ? await Promise.all([
      getPublicPosts({ authorUsername: profile.profile.username, cursor: parsed.cursor }),
      getOwnPostCount(),
    ]) : [null, null];
  return <main className="profile-page social-page">
    <header className="profile-header social-header">
      <Link className="brand" href="/">VIA</Link>
      <nav className="profile-actions" aria-label="Publicaciones">
        <Link className="button button-secondary" href="/inicio">Ver feed</Link>
        <Link className="button button-primary" href="/crear">Crear publicación</Link>
        <Link href="/perfil">Mi perfil</Link>
      </nav>
    </header>
    <section aria-labelledby="gallery-title">
      <div className="gallery-intro">
      <p className="eyebrow">Tu colección visual</p>
      <h1 id="gallery-title" className="post-list-title">Mi galería</h1>
      <p>Ideas que merecen verse. Abre una imagen para ver sus detalles, editarla o eliminarla.</p>
      {count && <p role="status">{count.status === "ready"
        ? `Total: ${count.count} ${count.count === 1 ? "publicación" : "publicaciones"}.`
        : "No pudimos cargar el total de publicaciones."}</p>}
      </div>
      {query.retirado === "1" && <p role="status" className="form-status">
        Publicación retirada.{query.limpieza === "pendiente" ? " Quedan imágenes pendientes de limpieza." : ""}
      </p>}
      {result ? <PostList result={result} basePath="/imagenes" paginated={Boolean(parsed.valid && parsed.cursor)} />
        : <p className="form-status" role="status">
          {parsed.valid ? "No pudimos cargar tu perfil." : "El enlace de paginación no es válido."} <Link href="/imagenes">Volver a intentar</Link>
        </p>}
      {profile.status === "found" && <PostCleanupButton />}
    </section>
  </main>;
}
