import Image from "next/image";
import {
  getSafeAvatarUrl,
  type PublicProfile,
} from "@/lib/profiles/read-profile";

export function ProfileDetails({ profile }: { profile: PublicProfile }) {
  const avatarUrl = getSafeAvatarUrl(
    profile.avatarUrl,
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );

  return (
    <section className="profile-details" aria-labelledby="profile-title">
      <div className="profile-identity">
        {avatarUrl ? (
          <Image
            className="profile-avatar"
            src={avatarUrl}
            alt={`Avatar de ${profile.displayName}`}
            width={96}
            height={96}
            sizes="96px"
          />
        ) : (
          <span className="profile-avatar profile-avatar-empty" role="img" aria-label="Sin avatar">
            <span aria-hidden="true">{profile.displayName.slice(0, 1)}</span>
          </span>
        )}
        <div>
          <p className="eyebrow">Perfil de VIA</p>
          <h1 id="profile-title">{profile.displayName}</h1>
          <p className="profile-username">@{profile.username}</p>
        </div>
      </div>
      <dl className="account-summary">
        <div>
          <dt>Biografía</dt>
          <dd className="profile-bio">{profile.bio || "Sin biografía todavía."}</dd>
        </div>
        <div>
          <dt>Rol en VIA</dt>
          <dd>{profile.role}</dd>
        </div>
      </dl>
      <section className="profile-future" aria-labelledby="profile-future-title">
        <h2 id="profile-future-title">Tu actividad en VIA</h2>
        <p>Las publicaciones, seguidores, seguidos y medallas se habilitarán en próximas fases.</p>
      </section>
    </section>
  );
}
