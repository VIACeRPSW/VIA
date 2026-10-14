import Link from "next/link";

export default function ProfileNotFound() {
  return (
    <main className="profile-page">
      <section className="profile-form-panel" aria-labelledby="profile-not-found-title">
        <h1 id="profile-not-found-title">Perfil no encontrado</h1>
        <p>No existe un perfil público con ese nombre de usuario.</p>
        <Link className="button button-secondary" href="/">Volver al inicio</Link>
      </section>
    </main>
  );
}
