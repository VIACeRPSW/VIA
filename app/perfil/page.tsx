import { SignOutButton, UserButton } from "@clerk/nextjs";
import { auth, currentUser } from "@clerk/nextjs/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getProfileDataStatus } from "@/lib/supabase/profile-status.server";
import { getProfileDataStatusLabel } from "@/lib/supabase/profile-status";

export default async function ProfileWelcomePage() {
  const { isAuthenticated } = await auth();

  if (!isAuthenticated) {
    redirect("/sign-in");
  }

  const user = await currentUser();
  const displayName = user?.firstName ?? user?.fullName ?? "estudiante";
  const email =
    user?.primaryEmailAddress?.emailAddress ?? "Cuenta de Clerk conectada";
  const dataConnectionStatus = await getProfileDataStatus();
  const dataStatusLabel = getProfileDataStatusLabel(dataConnectionStatus);

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

      <section className="welcome-panel" aria-labelledby="welcome-title">
        <p className="eyebrow">Tu bienvenida en VIA</p>
        <h1 id="welcome-title">Hola, {displayName}.</h1>
        <p className="welcome-copy">
          Tu identidad está autenticada con Clerk. El perfil editable de VIA
          se habilitará en la siguiente fase.
        </p>
        <dl className="account-summary">
          <div>
            <dt>Cuenta</dt>
            <dd>{email}</dd>
          </div>
          <div>
            <dt>Categoría inicial</dt>
            <dd>user</dd>
          </div>
          <div>
            <dt>Datos de VIA</dt>
            <dd>{dataStatusLabel}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}