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
