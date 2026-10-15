# VIA --- Roadmap

## Fase 0 --- Definición

### Objetivo

Dejar especificado el proyecto antes de programar.

-   ERS.
-   Alcance.
-   Arquitectura.
-   Modelo de datos.
-   Seguridad.
-   Estructura Next.js.
-   UI/UX.
-   Testing.
-   Backlog.

**Salida:** documentación aprobada.

## Fase 1 --- Base técnica

-   Crear repositorio.
-   Crear proyecto Next.js.
-   Configurar TypeScript.
-   Configurar Tailwind.
-   Configurar Clerk.
-   Configurar Supabase.
-   Configurar variables de entorno.
-   Configurar estructura de carpetas.
-   Crear migraciones.
-   Crear RLS inicial.

**Salida:** aplicación ejecutándose con autenticación y conexión de
datos.

## Fase 2 --- Usuarios

-   Perfil.
-   Avatar.
-   Username.
-   Roles.
-   Protección de rutas.

**Salida:** sistema de usuarios funcional.

## Fase 3 --- Publicaciones

-   Storage.
-   Crear publicación.
-   Listar.
-   Detalle.
-   Editar.
-   Eliminar.
-   Crear, editar y mostrar de 1 a 5 hashtags obligatorios por publicación
    (ampliación aprobada el 2026-10-15). Sin búsqueda por hashtag todavía.

**Salida:** CRUD completo.

Cerrada por decisión del usuario el 2026-10-15, con CRUD y diseño aceptados.
Las comprobaciones ampliadas no ejecutadas se conservan como diferidas, no
aprobadas, en [el cierre de Fase 3](../fases/fase03.md#puerta-de-fase-4).

## Fase 4 --- Interacción

-   Likes.
-   Comentarios.
-   Compartir.
-   Seguimiento.

**Salida:** núcleo social.

Plan ejecutable: [Fase 04 — Interacción](../fases/fase04.md).
Estado: en curso desde el 2026-10-15. Sprint 1.1 consolidado; likes
implementados y aprobados manualmente, con JWT vencido y rollback/
reaplicación diferidos explícitamente por el usuario, no aprobados.
Sprint 2.1 autorizado e implementado: lectura/creación de comentarios,
conteos, paginación e idempotencia, con migraciones por MCP y pruebas
unitarias, SQL, rollback/reaplicación y E2E reales aprobadas, incluido
JWT vencido de comentarios. Se conservan base y diseño existentes.
Siguen eliminación propia (2.2), compartir (3.1) y seguimiento básico
(4.1), sin personalizar el feed. Sin commit ni despliegue nuevo.

## Fase 5 --- Comunidades y búsqueda

-   Comunidades.
-   Miembros.
-   Categorías.
-   Búsqueda.
-   Filtros.
-   Búsqueda y navegación por hashtags ya persistidos desde Fase 3.

**Salida:** descubrimiento y organización.

## Fase 6 --- Gamificación

-   Medallas.
-   Ranking.
-   Estadísticas.

**Salida:** sistema de participación.

## Fase 7 --- Moderación

-   Reportes.
-   Panel de moderación.
-   Administración.
-   Gestión de roles.

**Salida:** plataforma administrable.

## Fase 8 --- Recomendaciones

-   Recomendaciones por intereses.
-   Popularidad.
-   Comunidades.
-   Seguimientos.

## Fase 9 --- IA avanzada

-   Generación.
-   Asistencia.
-   Etiquetado.
-   Moderación asistida.

Cada fase deberá cerrarse con pruebas antes de avanzar.
