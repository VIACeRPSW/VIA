# VIA

Red social educativa para descubrir y compartir recursos visuales creados
con inteligencia artificial.

## Requisitos

- Node.js 20.9 o posterior.
- npm 10 o posterior.
- Aplicaciones configuradas en Clerk y Supabase.

## Primer arranque

```bash
npm install
npm run typecheck
npm run lint
npm run dev
```

La aplicación queda disponible en [http://localhost:3000](http://localhost:3000).

## Variables de entorno

Crear `.env.local` a partir de `.env.example` y completar sus valores en el
equipo local. `.env.local` está excluido de Git y nunca debe compartirse ni
versionarse.

Las variables con prefijo `NEXT_PUBLIC_` pueden incluirse en el bundle del
navegador. `CLERK_SECRET_KEY` es exclusiva del servidor.

Para Supabase, añadir a `.env.local`:

```text
NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_<valor>
```

La contraseña de PostgreSQL no se guarda en `.env.local`: se introduce
directamente en la terminal solo cuando Supabase CLI la solicite al enlazar o
aplicar migraciones. Tampoco se necesita una `service_role` para el acceso
ordinario de VIA.

En Supabase, registrar la instancia de Clerk en **Authentication → Third-Party
Auth** usando su dominio Frontend API. En desarrollo:

```text
https://elegant-katydid-2433.clerk.accounts.dev
```

Esta confianza permite validar el JWT de Clerk; no requiere copiar secretos de
Clerk en Supabase.

## Clerk por entorno

Google debe estar habilitado como método de acceso en la instancia de Clerk.
Configurar como orígenes y URLs de retorno únicamente los dominios utilizados:

- Local: `http://localhost:3000`.
- Preview: la URL HTTPS asignada a cada despliegue de Vercel autorizado.
- Production: el dominio HTTPS definitivo de VIA.

Las rutas de acceso son `/sign-in` y `/sign-up`; después de autenticarse, VIA
redirige a `/perfil`. Cada instancia de Clerk debe autorizar sus dominios antes
de probar el flujo. No registrar comodines más amplios de lo necesario.

## Vercel

Configurar en Vercel los nombres definidos en `.env.example` para Development,
Preview y Production. La decisión actual permite usar los mismos valores de
Clerk y Supabase en Preview y Production; se debe restringir el acceso a las
previews y revisar esta decisión antes de almacenar datos reales.

| Variable | Development | Preview | Production | Exposición |
| --- | --- | --- | --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Requerida | Requerida | Requerida | Cliente |
| `CLERK_SECRET_KEY` | Requerida | Requerida | Requerida | Solo servidor |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | `/sign-in` | `/sign-in` | Cliente |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | `/sign-up` | `/sign-up` | Cliente |
| `NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL` | `/perfil` | `/perfil` | `/perfil` | Cliente |
| `NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL` | `/perfil` | `/perfil` | `/perfil` | Cliente |
| `NEXT_PUBLIC_SUPABASE_URL` | Requerida | Requerida | Requerida | Cliente |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Requerida | Requerida | Requerida | Cliente |

### Lista de comprobación de despliegue

1. Vincular el repositorio a Vercel y restringir el acceso a los despliegues Preview.
2. Cargar todas las variables de la tabla en cada entorno autorizado, sin marcar `CLERK_SECRET_KEY` como pública.
3. Registrar en Clerk el origen exacto de cada Preview autorizado y el dominio de Production, con `/sign-in`, `/sign-up` y retorno a `/perfil`; no usar comodines amplios.
4. Si un entorno usa otra instancia de Clerk, registrar su Frontend API en Third-Party Auth de Supabase.
5. Ejecutar `npm run test`, `npm run typecheck`, `npm run lint`, `npm run build` y `npm run test:client-secrets` antes del despliegue.
6. En cada entorno desplegado, comprobar acceso Google, llegada a `/perfil`, estado de Supabase, cierre de sesión y rechazo del acceso directo anónimo.

No escribir valores reales en documentación, commits, incidencias o capturas.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:client-secrets
npm run test:db:auth-boundary
npm run test:db:rls
npm run test:db:rollback
```
