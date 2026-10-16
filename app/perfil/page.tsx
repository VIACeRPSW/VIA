import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { getProfileForRoute } from "@/lib/profiles/profile-route.server";
import { ProfileFollows } from "@/components/profile/ProfileFollows";
import { getProfileFollows } from "@/lib/profiles/read-follows.server";

export default async function ProfilePage() {
  const result = await getProfileForRoute("existing");
  const follows = result.status === "found" ? await getProfileFollows({ profileId: result.profile.id }) : null;

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link className="brand" href="/" aria-label="VIA, volver al inicio">
          VIA
        </Link>
        <div className="profile-actions">
          <SignOutButton redirectUrl="/">
            <button className="button button-secondary" type="button">
              Cerrar sesión
            </button>
          </SignOutButton>
          <UserButton />
        </div>
      </header>

      {result.status === "found" ? (
        <>
          <ProfileDetails profile={result.profile} />
          {follows && <ProfileFollows key={result.profile.id} username={result.profile.username} initial={follows} />}
          <nav className="profile-actions" aria-label="Acciones de mi perfil">
            <Link className="button button-secondary" href="/inicio">Ver feed</Link>
            <Link className="button button-secondary" href="/imagenes">Mi galería</Link>
            <Link className="button button-primary" href="/crear">Crear publicación</Link>
            <Link className="button button-primary" href="/perfil/editar">Editar mi perfil</Link>
            <Link className="button button-secondary" href={`/usuario/${result.profile.username}`}>
              Ver perfil público
            </Link>
          </nav>
        </>
      ) : (
        <section className="profile-form-panel" aria-labelledby="profile-error-title">
          <h1 id="profile-error-title">Perfil no disponible</h1>
          <p className="form-status" role="status">
            No pudimos cargar tu perfil. Inténtalo de nuevo más tarde.
          </p>
        </section>
      )}
    </main>
  );
}