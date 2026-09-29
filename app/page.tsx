import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
} from "@clerk/nextjs";
import Link from "next/link";

export default function Home() {
  return (
    <main className="home-shell">
      <header className="site-header">
        <a className="brand" href="#inicio" aria-label="VIA, ir al inicio">
          VIA
        </a>
        <nav className="auth-nav" aria-label="Acceso a la cuenta">
          <Show when="signed-out">
            <SignInButton mode="redirect">
              <button className="button button-secondary" type="button">
                Iniciar sesión
              </button>
            </SignInButton>
            <SignUpButton mode="redirect">
              <button className="button button-primary" type="button">
                Crear cuenta
              </button>
            </SignUpButton>
          </Show>
          <Show when="signed-in">
            <Link className="button button-primary" href="/perfil">
              Mi bienvenida
            </Link>
            <UserButton />
          </Show>
        </nav>
      </header>

      <section className="hero" id="inicio" aria-labelledby="hero-title">
        <p className="eyebrow">Ideas que inspiran aprendizaje</p>
        <h1 id="hero-title">Aprender también puede empezar con una imagen.</h1>
        <p className="hero-copy">
          VIA será el lugar donde estudiantes y docentes compartan recursos
          visuales educativos creados con inteligencia artificial.
        </p>
        <Show
          when="signed-out"
          fallback={
            <p className="status" role="status">
              Tu sesión está activa. Ya puedes entrar a tu bienvenida.
            </p>
          }
        >
          <p className="status" role="status">
            Accede con Google para abrir tu bienvenida personal.
          </p>
        </Show>
      </section>

      <footer>
        <p>VIA · Red social educativa</p>
      </footer>
    </main>
  );
}
