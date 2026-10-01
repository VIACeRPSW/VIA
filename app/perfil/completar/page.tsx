import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CompleteProfileForm } from "@/components/profile/CompleteProfileForm";
import { resolveWelcomeIdentity } from "@/lib/clerk/welcome-identity";
import { getProfileDataStatus } from "@/lib/supabase/profile-status.server";
import { getProfileDataStatusLabel } from "@/lib/supabase/profile-status";

export default async function CompleteProfilePage() {
  const { isAuthenticated, userId } = await auth();

  if (!isAuthenticated || !userId) {
    redirect("/sign-in");
  }

  const profileStatus = await getProfileDataStatus();

  if (profileStatus === "profile-found") {
    redirect("/perfil");
  }

  const canCreateProfile = profileStatus === "ready";
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
            {getProfileDataStatusLabel(profileStatus)}. Inténtalo de nuevo más
            tarde.
          </p>
        )}
      </section>
    </main>
  );
}