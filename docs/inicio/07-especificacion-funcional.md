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
 -> completar entre 1 y 5 hashtags únicos obligatorios
 -> opcionalmente comunidad cuando se habilite en Fase 5
 -> publicar
 -> guardar archivo
 -> guardar metadata
 -> mostrar publicación
```

Desde Fase 3, los hashtags se crean, editan y muestran como texto, sin
enlaces de búsqueda. Se aplica el contrato de [RF-04](01-ers.md):
2–30 caracteres por etiqueta, letras Unicode, números y guion bajo;
minúsculas y NFC, prefijo `#` opcional solo en entrada y deduplicación
antes de validar la cantidad. Un error conserva los datos y no produce
una publicación parcial. La búsqueda por hashtag corresponde a Fase 5.

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
