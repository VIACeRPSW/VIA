import Link from "next/link";
import { notFound } from "next/navigation";
import { ProfileDetails } from "@/components/profile/ProfileDetails";
import { getPublicProfile } from "@/lib/profiles/read-profile.server";

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const result = await getPublicProfile(username);

  if (result.status === "missing") {
    notFound();
  }

  return (
    <main className="profile-page">
      <header className="profile-header">
        <Link className="brand" href="/" aria-label="VIA, volver al inicio">VIA</Link>
        <Link className="button button-secondary" href="/perfil">Mi perfil</Link>
      </header>
      {result.status === "found" ? (
        <ProfileDetails profile={result.profile} />
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
