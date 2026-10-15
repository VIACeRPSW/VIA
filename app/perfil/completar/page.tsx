import { currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { CompleteProfileForm } from "@/components/profile/CompleteProfileForm";
import { resolveWelcomeIdentity } from "@/lib/clerk/welcome-identity";
import { getProfileForRoute } from "@/lib/profiles/profile-route.server";

export default async function CompleteProfilePage() {
  const result = await getProfileForRoute("onboarding");
  const canCreateProfile = result.status === "missing";
  const identity = canCreateProfile
    ? await resolveWelcomeIdentity(currentUser)
    : null;

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link className="brand" href="/" aria-label="VIA, volver al inicio">
          VIA
        </Link>
      </header>

      <section className="profile-form-panel" aria-labelledby="profile-form-title">
        <p className="eyebrow">Tu espacio en VIA</p>
        <h1 id="profile-form-title">Completa tu perfil</h1>
        <p className="welcome-copy">
          Elige cómo aparecerás en VIA. Podrás editar estos datos más adelante.
        </p>
        {identity ? (
          <CompleteProfileForm initialDisplayName={identity.displayName} />
        ) : (
          <p className="form-status" role="status">
            No pudimos cargar tu perfil. Inténtalo de nuevo más tarde.
          </p>
        )}
      </section>
    </main>
  );
}