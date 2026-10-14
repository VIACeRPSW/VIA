import { SignOutButton, UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";

export default async function ProfilePage() {
  const result = await getOwnProfile();

  if (result.status === "unauthorized") {
    redirect("/sign-in");
  }

  if (result.status === "missing") {
    redirect("/perfil/completar");
  }

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
          <nav className="profile-actions" aria-label="Acciones de mi perfil">
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