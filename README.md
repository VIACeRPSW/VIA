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

## Consulta de perfiles

`/perfil` muestra el perfil persistente de la sesión Clerk y deriva a
`/perfil/completar` cuando todavía no existe. `/usuario/[username]` permite
visitar un perfil público sin iniciar sesión, usando el username canónico
en minúsculas; nombres inexistentes o no canónicos muestran el estado 404.
Un fallo del servicio se distingue de un perfil inexistente.

La consulta pública usa la función PostgreSQL `get_public_profile`, que
devuelve únicamente username, nombre visible, biografía, avatar y rol.
No concede lectura anónima de `profiles` ni expone identificadores Clerk.
La migración y su rollback están versionados en `supabase/`.

`/perfil/editar` permite cambiar username, nombre visible y biografía del
perfil propio. La acción comprueba sesión y propiedad en cada envío,
normaliza los campos y actualiza los tres de forma atómica. Un username
ocupado conserva los datos anteriores y muestra un error de campo.
Identidad, rol, avatar y timestamps no forman parte de la entrada editable.
Tras cambiar username se actualizan los enlaces y la URL anterior deja de
encontrar el perfil.

La subida de avatar sigue pendiente en Fase 2. Por ahora solo se
renderizan referencias de avatar público del bucket `avatars` en el origen
Supabase configurado, sin URLs externas ni firmadas; se usa un fallback
accesible cuando no hay avatar. La optimización y el contrato definitivo de
Storage se resolverán en el Sprint 2.2.

El formulario de edición tiene contador de biografía, estado de guardado y
foco en el error o resultado. Su revisión manual con lector de pantalla
sigue pendiente; no se considera cerrado el Sprint 2.1 solo por sus pruebas
automatizadas.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:client-secrets
npm run test:db:auth-boundary
npm run test:db:rls
npm run test:db:public-profiles
npm run test:db:rollback
```

`test:db:public-profiles` prueba la proyección pública, el aislamiento de
la tabla privada y el rollback/reaplicación de la función dentro de una
transacción que se revierte. Requiere un proyecto enlazado y la migración
`add_public_profile_lookup` aplicada; no conserva perfiles de prueba.

`test:db:rls` también comprueba edición propia de tres campos, atomicidad
frente a un username ocupado y rechazo de escritura ajena, anónima o en
columnas protegidas. Sus fixtures se eliminan mediante rollback.
