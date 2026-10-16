# VIA --- API y Server Actions

## 1. Principio

No se creará una API REST completa si Next.js Server Actions resuelve
una operación interna.

## 2. Server Actions iniciales

### Posts

``` text
createPost(data)
updatePost(postId, data)
deletePost(postId)
```

El contrato de Fase 3 incorpora hashtags obligatorios en `createPost`
y `updatePost`: entre 1 y 5 etiquetas únicas de 2–30 caracteres, con
normalización y caracteres según [RF-04](01-ers.md). La validación se
repite en servidor y PostgreSQL; campos y etiquetas se guardan de forma
atómica. Las consultas devuelven las etiquetas del contenido autorizado,
sin exponer identidades privadas ni permitir mutaciones ajenas.
No se incorpora una operación de búsqueda por hashtag hasta Fase 5.

Título obligatorio de 1–120 caracteres tras trim, descripción opcional de
0–2000 y categoría existente obligatoria. Autor, rol, estado, timestamps
y referencia de Storage no se aceptan del formulario. El servidor genera
una operación UUID de idempotencia vinculada a sesión y payload: repetirla
devuelve la misma publicación; reutilizarla con datos distintos da conflicto.
La edición usa una versión esperada y rechaza actualizaciones obsoletas.
El borrado exige confirmación explícita, retira la lectura pública antes
de limpiar archivos y distingue retirada de limpieza física completada.
Los roles elevados tampoco pueden mutar publicaciones ajenas en Fase 3.

Las consultas públicas usan cursor compuesto `(created_at, id)` descendente,
12 elementos por página y proyección explícita del autor, sin identidad
Clerk ni ID privado del perfil. El DTO de imagen contiene una URL firmada
de 60 segundos generada en lectura, nunca persistida. No se firma contenido
pendiente ni retirado para terceros; la entrega debe respetar esa caducidad.

### Likes

``` text
setPostLike(postId, liked)
```

UUID y booleano estricto; sesión y perfil se comprueban en cada petición.
Actor derivado, nunca recibido. Repetir el mismo estado es idempotente.
Devuelve estado y conteo autoritativos, o error/unauthorized explícito;
no anuncia éxito ante respuesta perdida. La lectura de hasta 12 posts
por RPC devuelve conteos públicos y estado propio sin listas de actores.
Se revalidan feed/detalle; al recuperar foco se reconcilia el estado.

### Comments

``` text
createComment(postId, content, operationId)
deleteComment(commentId)
```

Contrato aprobado, implementación en Hito 2: texto plano de 1–1000 puntos
de código tras trim y UUID de envío único por actor. Reintento idéntico
devuelve el mismo comentario; mismo UUID con otro payload da conflicto.
Lectura pública por cursor `(created_at, id)` descendente, 12 por página.
Solo el autor elimina, con confirmación/cancelación en UI; repetir el
borrado propio es idempotente, sin ampliar permisos a moderadores.

Sprint 2.1 implementa `createCommentAction({ postId, content, operationId })`
y `loadPostComments(postId, cursor?)`. Solo acepta esos tres campos, deriva
el actor y confirma una proyección pública y conteo. Distingue inválido,
sesión ausente/vencida, perfil requerido, conflicto y servicio no disponible.
El formulario conserva texto/UUID tras respuesta perdida; un texto distinto
representa un nuevo envío. La lectura distingue post inexistente, lista
vacía y fallo; cursor conserva microsegundos y desempate por ID.
Los conteos del feed se leen por lote en servidor y un fallo no se presenta
como cero. No hay edición de comentarios.

Sprint 2.2 implementa `deleteCommentAction({ postId, commentId, confirmed: true })`.
Rechaza campos extra, deriva sesión/perfil y llama a
`delete_own_post_comment`, que vuelve a verificar autoría, post y expiración.
Repetir un ID ausente no elimina otra fila; post retirado se distingue de
lista vacía. El éxito confirma ambos IDs y primera página/conteo públicos,
sin identidades privadas, y revalida feed/detalle. La UI avisa que vuelve
a los comentarios recientes para rellenar huecos y conserva el borrador.
Un fallo o respuesta perdida conserva el comentario visible y permite
reintentar el mismo ID, sin descontar conteos de forma optimista.
`loadCommentViewer()` resuelve username propio ligado al actor actual
únicamente para mostrar controles; nunca sustituye la autorización SQL.

### Communities

``` text
joinCommunity(communityId)
leaveCommunity(communityId)
```

### Follows

``` text
setFollow(profileId, following)
```

Contrato aprobado, implementación en Hito 4: UUID estable de destino y
booleano estricto; actor derivado de sesión con perfil, sin auto-seguimiento.
El resultado confirma estado y conteos reales; no expone listas de
relaciones. Entre pestañas prevalece la última operación confirmada.
No modifica el orden reciente del feed.

### Compartir

Contrato aprobado, implementación en Hito 3: operación de navegador, sin
mutación remota. URL de `/post/[id]` con origen de aplicación configurado
por entorno; localhost permitido solo en desarrollo, nunca firma Storage.
Copia y Web Share opcional, con resultados distintos para éxito,
cancelación y error; alternativa accesible cuando faltan APIs.

### Profile

``` text
updateProfile(data)
```

La implementación de Fase 2 expone `updateProfileAction(previousState,
formData)` y reutiliza el contrato de alta para username, nombre visible y
biografía. El estado previo no es una fuente de identidad ni autorización.
La acción obtiene la sesión Clerk y la fila propia en servidor, y actualiza
solo esos tres campos filtrando por ID persistido y `clerk_user_id`.

Identificador, identidad Clerk, rol, avatar y timestamps se ignoran si
aparecen como campos adicionales: no son parte de esta operación. El rol
almacenado se muestra como solo lectura; la matriz RLS existente se conserva.
No se implementa edición administrativa ni subida de avatar en esta acción.

El resultado distingue éxito, errores de campo, username ocupado, sesión
no disponible y fallo temporal, conservando los valores del formulario.
La restricción única de PostgreSQL resuelve conflictos y carreras; nunca
se informa éxito cuando la actualización no confirma la fila propia.
Después de guardar se revalidan perfil, edición y URLs públicas anterior
y nueva. El cambio de username no crea un alias para la dirección anterior.

### Avatar

`avatarAction(previousState, formData)` acepta `operation` con valores
`upload`, `remove` o `cleanup`. Solo `upload` recibe un archivo `avatar`;
identidad, ruta, URL y referencia anterior se resuelven en servidor.
La acción exige sesión Clerk y perfil propio en cada petición.

La carga valida bytes, MIME y límites, normaliza con Sharp, crea un ticket
privado, sube un objeto nuevo y confirma la referencia mediante
`commit_profile_avatar`. La RPC aplica compare-and-swap para que una pestaña
obsoleta no sobrescriba otro cambio. Después se limpia el objeto anterior.
La retirada confirma primero la referencia nula y después elimina el objeto.

El resultado distingue `success`, `error`, `warning` (cambio confirmado con
limpieza pendiente) y `unauthorized`. `avatarChanged` permite limpiar la
previsualización solo cuando cambió la referencia; `cleanupPending` permite
reintentar. Un fallo de limpieza no se informa como fallo del guardado ya
confirmado. No se borra una carga en curso antes de sus 10 minutos de lease.
Las mutaciones revalidan perfil, edición y perfil público; `cleanup`
revalida la edición para retirar avisos ya resueltos.

### Reports

``` text
createReport(data)
resolveReport(reportId, status)
```

## 3. Validación de una acción

Toda Server Action deberá seguir conceptualmente:

``` text
1. Recibir datos
2. Validar datos
3. Obtener usuario autenticado
4. Comprobar permisos
5. Ejecutar operación
6. Manejar error
7. Revalidar datos afectados
8. Devolver resultado controlado
```

## 4. Route Handlers

Podrán utilizarse para:

-   Webhooks de Clerk.
-   Integraciones externas.
-   Endpoints públicos específicos.
-   Operaciones que requieran HTTP explícito.

## 5. Errores

No se deberán exponer detalles internos de base de datos al usuario.

La aplicación deberá devolver mensajes comprensibles y registrar
información técnica donde corresponda.
