import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { PostList } from "@/components/posts/PostList";
import { getPublicPosts } from "@/lib/posts/read-post.server";
import { parsePostCursor, type PostSearchParams } from "@/lib/posts/post-cursor";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { getPublicProfile } from "@/lib/profiles/read-profile.server";
import { ProfileFollows } from "@/components/profile/ProfileFollows";
import { getProfileFollows } from "@/lib/profiles/read-follows.server";

export default async function PublicProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<PostSearchParams>;
}) {
  await connection();
  const { username } = await params;
  const result = await getPublicProfile(username);

  if (result.status === "missing") {
    notFound();
  }
  const cursor = parsePostCursor(await searchParams);
  const [posts, follows] = result.status === "found" ? await Promise.all([
    cursor.valid ? getPublicPosts({ authorUsername: result.profile.username, cursor: cursor.cursor }) : null,
    getProfileFollows({ username: result.profile.username }),
  ]) : [null, null];

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link className="brand" href="/" aria-label="VIA, volver al inicio">VIA</Link>
        <nav className="profile-actions" aria-label="Navegación">
          <Link className="button button-secondary" href="/inicio">Ver feed</Link>
          <Link className="button button-secondary" href="/perfil">Mi perfil</Link>
        </nav>
      </header>
      {result.status === "found" ? (
        <>
          <ProfileDetails profile={result.profile} />
          {follows && <ProfileFollows key={result.profile.username} username={result.profile.username} initial={follows} />}
          <section aria-labelledby="author-posts-title">
            <h2 id="author-posts-title">Publicaciones de {result.profile.displayName}</h2>
            {posts ? <PostList result={posts} basePath={`/usuario/${result.profile.username}`}
              paginated={Boolean(cursor.valid && cursor.cursor)} />
              : <p className="form-status" role="status">
                El enlace de paginación no es válido. <Link href={`/usuario/${result.profile.username}`}>Ver publicaciones recientes</Link>
              </p>}
          </section>
        </>
      ) : (
        <section className="profile-form-panel" aria-labelledby="profile-error-title">
          <h1 id="profile-error-title">Perfil no disponible</h1>
          <p className="form-status" role="status">
            No pudimos cargar este perfil. Inténtalo de nuevo más tarde.
          </p>
        </section>
      )}
    </main>
  );
}
