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
toggleLike(postId)
```

### Comments

``` text
createComment(postId, content)
deleteComment(commentId)
```

### Communities

``` text
joinCommunity(communityId)
leaveCommunity(communityId)
```

### Follows

``` text
toggleFollow(userId)
```

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
