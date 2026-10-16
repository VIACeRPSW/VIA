# VIA --- Modelo de datos

## 1. Principio

Supabase PostgreSQL almacenará los datos propios de VIA. Clerk
administrará la identidad externa del usuario.

## 2. Entidades

``` text
profiles
posts
categories
communities
community_members
comments
likes
shares
follows
badges
user_badges
reports
avatar_cleanup_tasks
```

## 3. profiles

``` text
profiles
---------
id
clerk_user_id
username
display_name
bio
avatar_url
role
created_at
updated_at
```

### Reglas

-   `clerk_user_id` es único.
-   `username` es único.
-   `role` pertenece al conjunto `user`, `moderator`, `admin`.
-   `role` tiene `user` como valor inicial y no puede modificarse mediante el
	acceso ordinario del usuario.

### Registro privado de limpieza de avatar

`avatar_cleanup_tasks` contiene `object_path` (clave primaria), `owner_sub`,
`state` (`uploading` o `cleanup`) y `expires_at`. El propietario se obtiene
del JWT y el vencimiento inicial es de 10 minutos; el cliente ordinario no
puede elegir propietario ni expiración. RLS limita consulta, inserción,
actualización de estado y eliminación al propietario.

Se crea un ticket antes de cargar un objeto inmutable en
`avatars/SHA256(sub)/UUID.webp`. `commit_profile_avatar` compara la referencia
anterior, rechaza tickets expirados, actualiza el perfil, consume el ticket
nuevo y agenda la referencia anterior en una sola transacción. Un proceso
de limpieza invocado por el usuario elimina primero el objeto físico y
después el ticket, sin borrar el avatar activo ni cargas todavía vigentes.
Esta tabla es operativa y nunca forma parte de la proyección pública.

## 4. posts

``` text
posts
-----
id
user_id
community_id
category_id
hashtags
title
description
image_url
prompt
status
created_at
updated_at
```

Relaciones:

-   `user_id -> profiles.id`
-   `community_id -> communities.id`
-   `category_id -> categories.id`

### Incremento aprobado para Fase 3 — 2026-10-15

- `category_id` obligatorio referencia el catálogo mínimo de Historia,
  Ciencia, Arte, Tecnología y Matemáticas. `community_id` y su FK se
  incorporarán en Fase 5, cuando exista `communities`, no en esta migración.
- `title`: 1–120 caracteres tras trim; `description`: 0–2000 caracteres.
  `prompt` no se ofrece como campo editable en Fase 3.
- `image_url` representa conceptualmente la imagen, pero el esquema de
  Fase 3 persistirá una ruta de objeto (`image_path`) validada, nunca una
  URL firmada ni una URL externa proporcionada por cliente.
- Solo publicaciones confirmadas (`published`) son públicas. Cargas
  pendientes y limpieza se representan en un registro operativo privado,
  sin filas incompletas visibles como publicaciones. Autor, ID y timestamps
  se derivan en servidor/base; idempotencia y versión de edición se
  concretan como garantías técnicas del Sprint 1.2.
- `hashtags` forma parte del contenido de la publicación: de 1 a 5 valores
  canónicos únicos, de 2 a 30 caracteres cada uno (letras Unicode, números
  y guion bajo). Se normalizan a minúsculas y NFC, sin almacenar el `#`
  inicial. No se eliminan tildes ni se convierte `ñ` a `n`.
- La cantidad se comprueba después de normalizar y quitar duplicados.
  Creación y edición deben guardar campos y hashtags de forma atómica;
  las restricciones deben impedir publicaciones sin hashtags también en
  escrituras directas. En Sprint 1.2 se implementa como `text[]` unidimensional,
  con base 1 y validación SQL inmutable; la base exige entrada ya canónica,
  no normaliza ni descarta valores inválidos silenciosamente. La acción
  normalizará y deduplicará antes de enviar. No se anticipan tablas sociales.
- Las lecturas públicas incluyen hashtags solo del contenido visible.
  No hay catálogo administrable, conteos, búsqueda ni rutas por hashtag
  en esta fase. Comunidades y membresías permanecen en Fase 5.

### Esquema incremental aplicado en Sprint 1.2

`posts` contiene `id`, `user_id`, `category_id`, `title`, `description`,
`hashtags`, `image_path`, `status`, `operation_id`, `version`, `created_at`
y `updated_at`. Solo se admite `status = 'published'`; cargas pendientes
no son publicaciones incompletas. `operation_id` es UUID obligatorio y único
por autor; la acción idempotente se completa en Sprint 2.2. `version`
empieza en 1 y el trigger la incrementa; la edición debe filtrar por versión
esperada para rechazar pérdida de cambios. Identidad, autor, operación,
estado y fecha de creación no son editables.

La referencia a `profiles` y `categories` es restrictiva, sin borrado en
cascada: eliminar un perfil con publicaciones requiere resolver antes su
contenido. Índices `(created_at DESC, id DESC)`, autor + orden y categoría
+ orden soportan la lectura estable. No hay columna `community_id`,
`prompt` ni URL firmada en esta migración.

La RPC `get_public_posts` combina explícitamente campos públicos de autor
con contenido confirmado y categoría, sin ampliar RLS de `profiles` ni
exponer `user_id`, `clerk_user_id`, `operation_id` o `version`.
Las tablas privadas de operación/limpieza y políticas Storage se añadirán
en Sprint 2.1 antes de habilitar el formulario de creación.

## 5. categories

``` text
categories
----------
id
name
description
created_at
```

## 6. communities

``` text
communities
-----------
id
name
description
image_url
creator_id
created_at
```

## 7. community_members

``` text
community_members
-----------------
id
community_id
user_id
joined_at
```

Restricción:

``` text
UNIQUE(community_id, user_id)
```

## 8. comments

``` text
comments
--------
id
post_id
user_id
content
created_at
updated_at
```

Contrato de Fase 4: comentarios con autor derivado de la sesión, FK de
post con `ON DELETE CASCADE` y de perfil restrictiva; texto plano de
1–1000 puntos de código tras trim. Un UUID de envío único por autor
permite reintentos; reutilizarlo con otro post/texto da conflicto.
Índice de lectura `(post_id, created_at DESC, id DESC)` y proyección pública
explícita del autor, sin Clerk ID. Su migración corresponde al Sprint 2.1.

Implementado en `20261015231817` y `20261015232459`: `id`, `post_id`,
`user_id`, `operation_id`, `content` y `created_at`. No hay edición ni
`updated_at` en este incremento. La escritura directa solo concede columnas
post/operación/texto y deriva identidad y fecha; `create_post_comment`
serializa por post y confirma comentario/conteo sin duplicar el envío.
`get_public_post_comments` devuelve como máximo 12 y consulta un elemento
adicional para determinar el siguiente cursor; `get_post_comment_counts`
devuelve agregados públicos de hasta 12 posts por lote, solo en el feed.

`comment_session_is_active` exige `exp` numérico futuro contra el reloj
actual de PostgreSQL. Una política restrictiva lo exige para acceso privado
y un trigger de INSERT también lo comprueba dentro de la RPC definer.
Ambos rollbacks bloquean la tabla y rechazan contenido existente; deben
retirarse en orden inverso. En 2.1 no se concedieron DELETE/UPDATE ordinarios.

Sprint 2.2 (`20261016000443`) añade DELETE ordinario limitado por autoría
y sesión vigente, sin UPDATE. `delete_own_post_comment(post, comentario)`
comprueba actor/post/expiración, bloquea la publicación igual que la creación
y retira solo la fila propia. Un ID ausente admite reintento; una fila ajena
o de otro post se rechaza. Devuelve primera página pública y conteo coherentes;
un post retirado devuelve null. Su rollback solo revoca esta capacidad, sin
eliminar datos, por lo que puede ensayarse con comentarios existentes.

## 9. likes

``` text
likes
-----
id
post_id
user_id
created_at
```

Restricción:

``` text
UNIQUE(post_id, user_id)
```

Fase 4: FK de post con `ON DELETE CASCADE`, FK de perfil restrictiva e
índice por usuario para lectura propia. Identidad y fecha se generan en
base; no hay UPDATE ordinario ni lectura de relaciones ajenas.
`set_post_like(postId, liked)` serializa operaciones por post y confirma
estado y conteo tras insertar con conflicto ignorado o retirar solo la
pareja propia. `get_post_likes(postIds)` limita cada lote a 12 IDs y
proyecta únicamente post, conteo, estado propio (null para anónimo) y
permiso de mutación. Ambas RPC tienen `search_path` vacío y grants mínimos.
No se cambian la proyección ni las políticas de perfiles/publicaciones.

## 10. shares

``` text
shares
------
id
post_id
user_id
created_at
```

`shares` queda conceptual: no se crea tabla ni se registran eventos en
Fase 4; compartir solo construye el enlace público del detalle.

## 11. follows

``` text
follows
-------
id
follower_id
following_id
created_at
```

Restricciones:

``` text
UNIQUE(follower_id, following_id)
follower_id != following_id
```

Contrato de Fase 4: ambas FK de perfil son restrictivas; actor derivado
de sesión, estado deseado idempotente, sin auto-seguimiento ni privilegios
de moderación. Índices por cada extremo permiten conteos por lote.
Solo se publican agregados; no hay listas públicas de seguidores/seguidos.
Cambiar username no rompe la relación por ID. Migración en Sprint 4.1,
con autorización independiente de la otorgada para likes.

## 12. badges

``` text
badges
------
id
name
description
icon_url
requirement
created_at
```

## 13. user_badges

``` text
user_badges
-----------
id
user_id
badge_id
earned_at
```

## 14. reports

``` text
reports
-------
id
reporter_id
post_id
comment_id
reported_user_id
reason
status
reviewed_by
created_at
reviewed_at
```

## 15. Relaciones

``` text
profiles 1 ---- N posts
profiles 1 ---- N comments
profiles N ---- N posts        mediante likes
profiles N ---- N profiles     mediante follows
profiles N ---- N communities  mediante community_members
profiles N ---- N badges       mediante user_badges
posts N ---- 1 categories
posts N ---- 1 communities
posts 1 ---- N comments
posts 1 ---- N likes
posts 1 ---- N shares
```

## 16. Índices iniciales

Se deberán evaluar índices para:

-   `posts.created_at`
-   `posts.category_id`
-   `posts.community_id`
-   `posts.user_id`
-   `comments.post_id`
-   `likes.post_id`
-   `community_members.community_id`
-   `community_members.user_id`
-   `follows.follower_id`
-   `follows.following_id`

Los índices definitivos se ajustarán según las consultas reales del MVP.
