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

Las tres rutas privadas comparten una guarda de servidor que consulta el
perfil de la identidad Clerk autenticada y valida su rol almacenado
(`user`, `moderator` o `admin`). Una sesión ausente o expirada vuelve a
`/sign-in`; sin perfil, consulta y edición dirigen a `/perfil/completar`;
con perfil válido, el alta dirige a `/perfil`. Un rol ausente o desconocido
o un fallo de datos impide mostrar formularios y no se interpreta como
ausencia de perfil. El rol es de solo lectura en la interfaz; cada acción
mantiene su propia comprobación de sesión y propiedad, además de RLS.

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

La edición incluye subida, previsualización, reemplazo y retirada del avatar.
Admite JPEG, PNG y WebP de hasta **2 MiB**, estáticos y con un máximo de
4096 píxeles por lado. El servidor decodifica el contenido real, comprueba
el MIME y lo convierte a WebP de hasta 512 × 512, sin ampliar ni conservar
metadatos. El límite multipart compartido de Server Actions es 6 MiB
para alojar publicaciones de hasta 5 MiB más los campos del formulario;
el avatar mantiene su validación específica de 2 MiB.

El bucket `avatars` es público: no debe usarse para información privada.
Los objetos son inmutables y usan `SHA256(sub)/UUID.webp`, sin publicar
literalmente el identificador Clerk. Solo se renderizan referencias del
origen Supabase configurado, sin URLs externas ni firmadas, con optimización
Next Image y fallback accesible. Retirar el avatar elimina su referencia y
su objeto, pero no revoca copias públicas ni cachés ya distribuidas.

Storage y PostgreSQL no comparten transacción. Un registro privado de limpieza
precede a la carga; una RPC compare-and-swap confirma la referencia y agenda
el avatar anterior de forma atómica. Un fallo parcial deja un aviso y permite
reintentar la limpieza. Las cargas interrumpidas pueden limpiarse tras
10 minutos; no se ejecuta un proceso automático de limpieza en segundo plano.
No se usa `service_role` en el flujo ordinario.

El formulario de edición tiene contador de biografía, estado de guardado y
foco en el error o resultado. El Sprint 2.1 está completado con pruebas
automatizadas y confirmación del usuario de la revisión manual solicitada.

## Comprobaciones

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run test:client-secrets
npm run test:db:auth-boundary
npm run test:db:rls
npm run test:db:roles
npm run test:db:public-profiles
npm run test:db:avatars
npm run test:db:rollback
```

`test:db:public-profiles` prueba la proyección pública, el aislamiento de
la tabla privada y el rollback/reaplicación de la función dentro de una
transacción que se revierte. Requiere un proyecto enlazado y la migración
`add_public_profile_lookup` aplicada; no conserva perfiles de prueba.

`test:db:rls` también comprueba edición propia de tres campos, atomicidad
frente a un username ocupado y rechazo de escritura ajena, anónima o en
columnas protegidas. Sus fixtures se eliminan mediante rollback.

`test:db:avatars` verifica propiedad, aislamiento del registro privado,
concurrencia y expiración dentro de una transacción revertida. El E2E
`avatar.spec.ts` usa dos usuarios Clerk Development y archivos generados
localmente; comprueba el flujo visual y la API real de Storage y limpia
objetos físicos antes de eliminar las identidades de prueba.

### Esquema de publicaciones (Fase 3)

La migración `20261015162153_add_posts_contract.sql` añade `categories`
con las cinco categorías aprobadas y `posts` con RLS forzada, autor derivado
del JWT, restricciones de contenido y hashtags canónicos `text[]`.
La migración incremental `20261015164718_add_post_publishing.sql` añade
el bucket privado `posts`, el registro privado `post_uploads` y las RPC
de preparación, confirmación y limpieza. Ambas están aplicadas en el
proyecto existente, junto a `profiles`; no se crea otra base.

### Probar una publicación mínima

1. Ejecutar `npm run dev` y abrir [Crear publicación](http://localhost:3000/crear).
2. Iniciar sesión y completar el perfil si todavía falta.
3. Elegir una imagen JPEG, PNG o WebP estática de hasta **5 MiB** y
   **4096 píxeles por lado**.
4. Escribir título (1–120 caracteres), seleccionar categoría y añadir
   al menos un hashtag; por ejemplo, `#ciencia`. La descripción es opcional.
5. Pulsar **Publicar**. Al confirmar se abre `/post/[id]`; recargar
   conserva los datos y la imagen. El detalle es público.

Los hashtags se normalizan a minúsculas/NFC, sin `#`, con 1–5 valores
únicos de 2–30 letras, números o guiones bajos. No son enlaces de búsqueda.
El servidor comprueba el contenido real y convierte la imagen a WebP sin
metadatos. El autor y la ruta se derivan de la sesión, no del formulario.
La confirmación es atómica e idempotente por operación; no se concede
INSERT directo de publicaciones ni UPDATE directo de su ruta de imagen.

Si falla una carga, el formulario permite reintentar y limpiar pendientes.
Una carga interrumpida conserva un lease de 10 minutos antes de poder
limpiarse; no hay un limpiador automático. No recargar durante un reintento
para conservar la identidad de la operación.

### Ver publicaciones y galería

- [Feed público](http://localhost:3000/inicio): publicaciones recientes,
  una columna con imágenes grandes, autor, título, descripción y etiquetas.
  Al acercarse al final se carga el siguiente lote sin cambiar de página;
  hay un botón alternativo para cargar más o reintentar si falla.
- [Mi galería](http://localhost:3000/imagenes): requiere sesión y perfil;
  muestra solo tus publicaciones y un total real protegido por RLS.
  Cuadrícula de tres columnas de imágenes, sin título ni descripción
  visibles. Cada imagen conserva un nombre accesible y abre su detalle.
- El perfil público `/usuario/[username]` muestra las publicaciones de
  ese autor. El perfil propio ofrece acceso al feed y a la galería.

Los listados se consultan en lotes de 12, ordenados por fecha e ID
descendentes, con cursor compuesto sin redondear timestamps. En las galerías,
**Ver anteriores** avanza y **Volver a las recientes** regresa al comienzo;
en el feed las imágenes se agregan al bajar, sin repetir IDs. Un enlace de
paginación malformado muestra un error explícito. Vacío, fallo de datos y
fallo de imagen tienen estados distintos. Las imágenes mantienen firma de
60 segundos sin optimizador Next. Si una imagen diferida falla, se intenta
renovar su firma una vez; si sigue fallando se muestra un estado explícito.

### Editar y eliminar tus posts

Abre un post propio desde tu galería. El detalle ofrece **Editar publicación**
y **Eliminar publicación**; estos controles no aparecen para otros autores
ni para visitantes sin sesión.

`/post/[id]/editar` permite cambiar título, descripción, categoría y hashtags
y reemplazar opcionalmente la imagen. Sin seleccionar archivo se conserva
el original. Una versión obsoleta se rechaza sin sobrescribir cambios.
El reemplazo usa la migración `20261015192000_add_post_image_replacement.sql`:
carga propia, confirmación atómica de la nueva referencia y registro de
limpieza de la imagen anterior. Una respuesta perdida puede recuperarse
reintentando la misma operación. No se habilita UPDATE directo de `image_path`.

Eliminar abre una confirmación accesible; **Cancelar** no modifica nada.
Confirmar retira la fila, actualiza las vistas y limpia el objeto. Si el
objeto no se puede retirar, se informa por separado y puedes reintentar
con **Limpiar imágenes pendientes** en tu galería. Una firma ya emitida
puede conservar validez hasta 60 segundos; las copias descargadas no se revocan.
Las acciones vuelven a comprobar sesión, perfil y propiedad bajo RLS,
incluidos moderadores/admin, y no aceptan rutas de borrado del cliente.

La tabla `posts` solo permite leer o mutar filas propias, también para
moderador/admin. La RPC pública `get_public_posts` entrega una proyección
sin identidad Clerk, ID privado de perfil, operación ni versión interna.
Acepta ID para detalle, username para galería o cursor compuesto
`p_before_created_at`/`p_before_id`, siempre con máximo 12 resultados.
Ambas partes del cursor son obligatorias juntas; una consulta inválida
produce un error explícito. La ruta de imagen se entrega sin firma;
el detalle obtiene una firma de 60 segundos por petición y muestra la imagen
sin pasar por el optimizador/caché de Next Image.

```bash
npm run test:db:posts
npm run test:db:posts:api
npm run test:db:posts:rollback
npm run test:db:posts:management
```

Las pruebas SQL usan perfiles y metadatos Storage efímeros dentro de una
transacción revertida; no suben archivos físicos ni necesitan secretos
administrativos en la aplicación. La prueba HTTP es de solo lectura y
comprueba catálogo, frontera privada, RPC pública y cursor inválido.
La matriz SQL verifica la forma de la proyección incluso si el feed real
está vacío.

`test:db:posts:management` ensaya reemplazo, repetición idempotente,
conflictos de versión, propiedad A/B, edición sin imagen, eliminación
y journal de limpieza en transacciones revertidas, más rollback/reaplicación
de su RPC. Para una retirada real, ejecutar rollbacks de más reciente a
más antiguo. No retirar el contrato de Storage dejando instalada la RPC
de reemplazo.

`test:db:posts:rollback` ensaya el incremento de publicación y sus políticas
dentro de transacciones revertidas; compara esquema, restricciones,
funciones, privilegios, triggers, RLS y bucket después de reaplicar y
comprueba que los perfiles existentes permanezcan intactos. Normaliza solo
los finales de línea Windows al comparar definiciones de funciones.
**Rechaza publicaciones, tickets u objetos existentes**; antes de una
retirada real se requiere respaldo y resolución de datos.
No elimina buckets ni objetos físicos, ni usa `CASCADE`. El runner anterior
`scripts/test-supabase-posts-migration.mjs` solo corresponde al contrato
previo a Storage y rechaza ejecutarse mientras exista `post_uploads`.

El E2E `post-publishing.spec.ts` publica un archivo de exactamente 5 MiB
con descripción vacía, corrige un error, comprueba persistencia, lectura
anónima, WebP firmado, confirmación repetida sin duplicación, privacidad
de una carga pendiente y detalle sin desbordamiento a 375/768/1280 px.
Retira únicamente sus propios posts, objetos, tickets, perfil y usuario
Clerk de desarrollo al terminar.

Para las comprobaciones ampliadas sin repetir ese CRUD:

```powershell
npx playwright test post-closure.spec.ts --project=chromium
npx playwright test profile-onboarding.spec.ts --project=chromium --grep "expired session"
```

`post-closure.spec.ts` usa dos identidades efímeras para contrastar permisos
de posts y Storage, galería ajena vacía, logout, teclado y anchos
360/768/1280. Comprueba preview/cancelación, un envío interrumpido con borrador
conservado, propagación de la edición tras recargar detalle/feed/galerías
y caducidad de una firma tras retirar el post, antes de limpiar
el objeto. La prueba de JWT expirado cubre rutas privadas de perfiles y
publicaciones. No equivalen a simular todos los fallos remotos de
carga/confirmación/limpieza ni a una auditoría accesible completa.

El estado verificable y los pendientes de cierre se registran en
[Fase 3](docs/fases/fase03.md#revisión-de-cierre--2026-10-15).
El diseño aprobado conserva feed en columna única con carga continua,
galerías solo-imágenes y controles de edición/borrado en el detalle propio.
No hay un despliegue nuevo confirmado.

### Continuar el desarrollo

La Fase 3 quedó cerrada por decisión del usuario el 2026-10-15, con sus
comprobaciones ampliadas no ejecutadas conservadas como diferidas, no aprobadas.
La [Fase 4 — Interacción](docs/fases/fase04.md) está en curso. Los contratos
del Sprint 1.1 están consolidados y el incremento de likes está implementado
en feed/detalle, con migración `20261015223045` aplicada por MCP al proyecto
existente. Las galerías conservan su grid solo-imágenes. Comentarios,
compartir y seguimiento siguen pendientes; las migraciones de comentarios
y seguimiento requieren autorización específica.

Like/unlike exige sesión y perfil, permite publicaciones propias y usa
estado deseado idempotente. Conteos públicos, estado personal privado,
lectura por lotes de hasta 12 y reconciliación al recuperar foco, sin listas
de personas. Un error permite reintentar sin anunciar éxito ficticio.

Comprobaciones enfocadas del incremento:

```powershell
npm run test -- actions\post-likes.test.ts actions\post-management.test.ts components\posts\post-likes.test.tsx components\posts\post-layout.test.tsx lib\posts\read-post.test.ts
npm run test:e2e -- post-likes
npm run test:db:likes
```

La prueba SQL usa una transacción con rollback; el E2E crea identidades,
posts e imágenes temporales y los limpia al terminar. El rollback de esquema
está versionado y rechaza likes existentes; su ensayo de retirada/reaplicación
no se da por ejecutado. Evidencia y pendientes exactos en
[Sprint 1.2](docs/fases/fase04.md#sprint-12--likeunlike-con-estado-y-conteo-reales).
No se hizo reset, otra base, commit ni despliegue.

Antes de aplicar el esquema de publicaciones de Fase 3 a una base Fase 2 sin `posts`/`categories`,
puede ensayarse sin persistir el esquema:

```powershell
node scripts\test-supabase-posts-migration.mjs --preflight
```

Este ensayo no equivale a reinstalar todo Supabase desde cero.

Para ensayar el rollback de avatar con bucket, referencias y registro vacíos:

```bash
node scripts/test-supabase-avatar-rollback.mjs 20261014202722_add_avatar_storage.sql
```

El ensayo revierte y reaplica solo los recursos de aplicación dentro de
una transacción que se deshace, verificando que el bucket queda intacto.
Para un rollback real, primero retirar referencias y objetos mediante la
aplicación/API de Storage, resolver el registro de limpieza y ejecutar el
SQL de rollback. **El bucket vacío se elimina después mediante la API de
Storage o el panel de Supabase**, no con `DELETE` SQL ni desactivando su
protección. Su eliminación física no forma parte del ensayo transaccional.
