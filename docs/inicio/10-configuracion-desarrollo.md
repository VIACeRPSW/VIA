# VIA --- Configuración de desarrollo

## 1. Requisitos

Instalar:

-   Node.js en una versión compatible con la versión elegida de Next.js.
-   Git.
-   Editor de código.

## 2. Crear proyecto

La aplicación deberá iniciarse como proyecto Next.js con:

-   TypeScript.
-   App Router.
-   ESLint.
-   Tailwind CSS si se utiliza en la configuración inicial.

## 3. Variables de entorno

Archivo:

``` text
.env.local
```

Variables conceptuales:

``` text
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
CLERK_SECRET_KEY=

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

Los nombres definitivos se ajustarán a la configuración actual de Clerk
y Supabase.

## 4. Reglas de entorno

-   `.env.local` no debe versionarse.
-   Las claves privadas deben mantenerse únicamente del lado servidor.
-   Nunca subir secretos a Git.

## 5. Supabase

Crear:

-   Proyecto.
-   Base PostgreSQL.
-   Buckets de Storage.
-   Tablas.
-   Relaciones.
-   Índices.
-   RLS.
-   Políticas.

## 6. Clerk

Configurar:

-   Aplicación.
-   Métodos de acceso.
-   URLs de desarrollo.
-   Integración con Next.js.
-   Middleware/protección de rutas.

## 7. Primer arranque

Flujo:

``` text
Clonar repositorio
 -> instalar dependencias
 -> configurar .env.local
 -> configurar Clerk
 -> configurar Supabase
 -> ejecutar migraciones
 -> npm run dev
```

## 8. Migraciones

El esquema de base de datos deberá versionarse mediante migraciones SQL
o el mecanismo elegido para el proyecto.

No se deberá depender exclusivamente de cambios manuales en el dashboard
de Supabase.
