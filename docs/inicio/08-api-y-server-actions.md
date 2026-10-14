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
