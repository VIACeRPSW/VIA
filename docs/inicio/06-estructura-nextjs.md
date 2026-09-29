# VIA --- Estructura de Next.js

## 1. Estructura propuesta

``` text
via/
├── app/
│   ├── (public)/
│   │   ├── page.tsx
│   │   ├── explorar/
│   │   └── comunidades/
│   ├── (auth)/
│   │   ├── sign-in/
│   │   └── sign-up/
│   ├── (platform)/
│   │   ├── inicio/
│   │   ├── comunidades/
│   │   ├── crear/
│   │   ├── imagenes/
│   │   ├── post/[id]/
│   │   ├── ranking/
│   │   └── perfil/
│   ├── admin/
│   │   ├── usuarios/
│   │   ├── publicaciones/
│   │   ├── comunidades/
│   │   ├── reportes/
│   │   └── medallas/
│   ├── api/
│   ├── layout.tsx
│   └── globals.css
│
├── components/
│   ├── ui/
│   ├── layout/
│   ├── posts/
│   ├── comments/
│   ├── communities/
│   ├── profile/
│   ├── ranking/
│   └── badges/
│
├── actions/
├── lib/
├── types/
├── hooks/
├── public/
├── middleware.ts
└── package.json
```

## 2. Convención de rutas

-   `/` --- portada.
-   `/inicio` --- feed autenticado.
-   `/explorar` --- descubrimiento.
-   `/comunidades` --- comunidades.
-   `/comunidades/[id]` --- detalle.
-   `/crear` --- crear publicación.
-   `/imagenes` --- publicaciones propias.
-   `/post/[id]` --- publicación.
-   `/ranking` --- ranking.
-   `/perfil` --- perfil propio.
-   `/usuario/[username]` --- perfil público.
-   `/admin` --- administración.

## 3. Componentes

Los componentes de negocio deben ser reutilizables.

Ejemplo:

``` text
PostCard
├── PostImage
├── PostAuthor
├── PostActions
└── PostStats
```

## 4. Separación de responsabilidades

-   `app`: rutas y composición de páginas.
-   `components`: interfaz reutilizable.
-   `actions`: mutaciones.
-   `lib`: clientes y utilidades.
-   `types`: tipos.
-   `hooks`: lógica reutilizable del cliente.

## 5. Regla

No colocar lógica de acceso a base de datos directamente en componentes
visuales cuando pueda centralizarse en `lib` o `actions`.
