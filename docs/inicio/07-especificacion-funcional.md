# VIA --- Especificación funcional

## 1. Registro y acceso

``` text
Usuario
 -> Registro/Login Clerk
 -> sesión válida
 -> Next.js reconoce usuario
 -> acceso a plataforma
```

## 2. Crear publicación

``` text
/crear
 -> seleccionar imagen
 -> completar título
 -> completar descripción
 -> seleccionar categoría
 -> opcionalmente comunidad/etiquetas
 -> publicar
 -> guardar archivo
 -> guardar metadata
 -> mostrar publicación
```

## 3. Feed

El feed mostrará tarjetas con:

-   Imagen.
-   Título.
-   Autor.
-   Descripción breve.
-   Likes.
-   Comentarios.
-   Compartir.

## 4. Like

``` text
Sin like
 -> click
 -> crear registro likes
 -> actualizar contador
```

Si ya existe:

``` text
Con like
 -> click
 -> eliminar registro
 -> actualizar contador
```

## 5. Comentario

``` text
Usuario
 -> escribe comentario
 -> validar
 -> Server Action
 -> insertar
 -> actualizar publicación
```

## 6. Comunidades

``` text
Comunidades
 -> listado
 -> seleccionar comunidad
 -> detalle
 -> unirse
 -> visualizar publicaciones
```

## 7. Búsqueda

Entrada:

``` text
"fotosíntesis"
```

Resultado:

-   publicaciones coincidentes;
-   categorías relacionadas;
-   comunidades relacionadas cuando corresponda.

## 8. Perfil

Debe mostrar:

-   Avatar.
-   Nombre.
-   Username.
-   Biografía.
-   Medallas.
-   Estadísticas.
-   Publicaciones.

## 9. Reporte

``` text
Publicación
 -> Reportar
 -> seleccionar motivo
 -> enviar
 -> reporte pendiente
 -> moderador/admin
 -> resolver
```
