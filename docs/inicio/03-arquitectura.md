# VIA --- Arquitectura técnica

## 1. Arquitectura general

VIA utilizará una arquitectura full-stack basada en Next.js.

``` text
Usuario
  |
  v
Next.js + React
  |
  +--> Clerk
  |     └── Autenticación e identidad
  |
  +--> Server Components
  +--> Client Components
  +--> Server Actions
  +--> Route Handlers
  |
  +--> Supabase
        +--> PostgreSQL
        +--> Storage
        └--> Row Level Security
```

## 2. Principios

-   Next.js es el framework principal.
-   React gestiona la interfaz.
-   Clerk es la fuente de identidad/autenticación.
-   Supabase almacena datos propios de VIA y archivos.
-   La autorización debe aplicarse tanto en la capa de aplicación como
    en la base de datos.
-   Los secretos nunca se exponen al cliente.

## 3. Server Components

Se priorizarán para:

-   Feed.
-   Detalle de publicación.
-   Perfil.
-   Comunidad.
-   Ranking.
-   Listados.

## 4. Client Components

Se utilizarán cuando exista interacción en el navegador:

-   LikeButton.
-   CommentForm.
-   SearchBar.
-   Filters.
-   UploadImage.
-   Modales.
-   Menús interactivos.

## 5. Server Actions

Se utilizarán para mutaciones internas:

-   Crear publicación.
-   Editar publicación.
-   Eliminar publicación.
-   Like/unlike.
-   Crear comentario.
-   Eliminar comentario.
-   Seguir/dejar de seguir.
-   Unirse/salir de comunidad.

## 6. Route Handlers

Se utilizarán cuando VIA necesite endpoints HTTP explícitos,
integraciones externas, webhooks o casos que requieran una API.

## 7. Despliegue

La aplicación podrá desplegarse en Vercel.

Supabase y Clerk funcionarán como servicios externos de datos e
identidad.

## 8. Flujo de publicación

``` text
Usuario
 -> /crear
 -> selecciona imagen
 -> almacenamiento en Supabase Storage
 -> obtiene referencia del archivo
 -> Server Action
 -> valida identidad y datos
 -> inserta publicación
 -> revalida la página
 -> muestra publicación
```
