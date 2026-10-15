import { randomUUID } from "node:crypto";
import Link from "next/link";
import { CreatePostForm } from "@/components/posts/CreatePostForm";
import { getProfileForRoute } from "@/lib/profiles/profile-route.server";
import { getPostCategories } from "@/lib/posts/read-post.server";

export default async function CreatePostPage() {
  const profile = await getProfileForRoute("existing");
  const result = profile.status === "found" ? await getPostCategories() : null;
  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link className="brand" href="/" aria-label="VIA, volver al inicio">VIA</Link>
        <Link className="button button-secondary" href="/perfil">Mi perfil</Link>
      </header>
      <section className="profile-form-panel" aria-labelledby="create-post-title">
        <h1 id="create-post-title">Crear publicación</h1>
        <p className="welcome-copy">Comparte una imagen educativa. Imagen, título, categoría y hashtags son obligatorios.</p>
        {result?.status === "ready"
          ? <CreatePostForm operationId={randomUUID()} categories={result.categories} />
          : <p className="form-status" role="status">No pudimos cargar los datos para publicar. Inténtalo de nuevo más tarde.</p>}
      </section>
    </main>
  );
}
