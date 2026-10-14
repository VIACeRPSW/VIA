import Link from "next/link";
import { redirect } from "next/navigation";
import { EditProfileForm } from "@/components/profile/EditProfileForm";
import { AvatarEditor } from "@/components/profile/AvatarEditor";
import { getAvatarCleanupStatus } from "@/lib/profiles/avatar-repository.server";
import { getSafeAvatarUrl } from "@/lib/profiles/read-profile";
import { getOwnProfile } from "@/lib/profiles/read-profile.server";

export default async function EditProfilePage() {
  const result = await getOwnProfile();

  if (result.status === "unauthorized") redirect("/sign-in");
  if (result.status === "missing") redirect("/perfil/completar");
  const cleanup = result.status === "found" ? await getAvatarCleanupStatus() : null;

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link className="brand" href="/" aria-label="VIA, volver al inicio">VIA</Link>
        <Link className="button button-secondary" href="/perfil">Mi perfil</Link>
      </header>
      <section className="profile-form-panel" aria-labelledby="profile-edit-title">
        <h1 id="profile-edit-title">Editar mi perfil</h1>
        {result.status === "found" ? (
          <>
            <p className="welcome-copy">
              Actualiza tus datos públicos. Tu identidad y rol no se pueden cambiar aquí.
            </p>
            <p>Rol en VIA: <strong>{result.profile.role}</strong></p>
            <EditProfileForm initialValues={{
              username: result.profile.username,
              displayName: result.profile.displayName,
              bio: result.profile.bio,
            }} />
            {cleanup && <AvatarEditor
              avatarUrl={getSafeAvatarUrl(result.profile.avatarUrl, process.env.NEXT_PUBLIC_SUPABASE_URL)}
              cleanupPending={cleanup.pending}
              cleanupUnavailable={cleanup.unavailable}
            />}
          </>
        ) : (
          <p className="form-status" role="status">
            No pudimos cargar tu perfil. Inténtalo de nuevo más tarde.
          </p>
        )}
      </section>
    </main>
  );
}
