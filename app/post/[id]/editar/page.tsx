import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CreatePostForm } from "@/components/posts/CreatePostForm";
import { getOwnPost, getPostCategories, getPublicPost } from "@/lib/posts/read-post.server";
import { getProfileForRoute } from "@/lib/profiles/profile-route.server";
import { PostImage } from "@/components/posts/PostImage";

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getProfileForRoute("existing");
  const { id } = await params;
  const own = profile.status === "found" ? await getOwnPost(id) : null;
  if (own?.status === "missing") notFound();
  const [categories, published] = own?.status === "found"
    ? await Promise.all([getPostCategories(), getPublicPost(id)]) : [null, null];
  return <main className="profile-page">
    <header className="profile-header">
      <Link className="brand" href="/inicio">VIA</Link>
      <Link href={`/post/${id}`}>Volver al post</Link>
    </header>
    <section className="profile-form-panel" aria-labelledby="edit-post-title">
      <p className="eyebrow">Dale otra vuelta a tu idea</p>
      <h1 id="edit-post-title">Editar publicación</h1>
      {own?.status === "found" && categories?.status === "ready" ? <>
        {published?.status === "found" && <PostImage key={published.imageUrl} id={id}
          title="Imagen actual de la publicación" initialUrl={published.imageUrl} sizes="(max-width: 672px) 100vw, 672px" />}
        <CreatePostForm operationId={randomUUID()} categories={categories.categories} editing={own.post} />
      </> : <p role="status" className="form-status">No pudimos cargar tu publicación para editar. Inténtalo más tarde.</p>}
    </section>
  </main>;
}
