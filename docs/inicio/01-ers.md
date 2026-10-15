# VIA --- ERS

## Especificación de Requisitos de Software

**Versión:** 0.1 --- Fase 0

## 1. Descripción

VIA es una red social educativa donde estudiantes y docentes pueden
crear, descubrir y compartir imágenes generadas con inteligencia
artificial, como infografías, mapas conceptuales, resúmenes visuales e
ilustraciones educativas.

El objetivo es transformar temas complejos en contenido visual fácil de
comprender y favorecer el aprendizaje colaborativo.

## 2. Objetivo general

Desarrollar una plataforma web educativa para publicar, descubrir,
organizar e interactuar con recursos visuales generados mediante IA.

## 3. Usuarios

### Usuario

Puede:

-   Registrarse e iniciar sesión.
-   Administrar su perfil.
-   Crear publicaciones.
-   Editar y eliminar sus publicaciones.
-   Explorar contenido.
-   Buscar y filtrar.
-   Dar likes.
-   Comentar.
-   Compartir.
-   Seguir usuarios.
-   Participar en comunidades.
-   Obtener medallas.

### Moderador

Además puede:

-   Revisar reportes.
-   Moderar publicaciones.
-   Moderar comentarios.
-   Gestionar comunidades asignadas.

### Administrador

Además puede:

-   Gestionar usuarios.
-   Gestionar roles.
-   Gestionar categorías.
-   Gestionar comunidades.
-   Gestionar medallas.
-   Gestionar reportes.
-   Gestionar contenido.

## 4. Requisitos funcionales

### RF-01 Autenticación

El sistema deberá permitir registro, inicio de sesión, cierre de sesión
y mantenimiento de sesión mediante Clerk.

### RF-02 Perfil

Cada usuario deberá disponer de nombre, nombre de usuario, avatar,
biografía, publicaciones, seguidores, seguidos y medallas.

### RF-03 Inicio / Feed

El sistema deberá mostrar publicaciones educativas y permitir ordenarlas
por criterios definidos por el producto.

### RF-04 Crear publicación

Una publicación deberá permitir almacenar como mínimo:

-   Imagen.
-   Título.
-   Descripción.
-   Categoría.
-   Hashtags: de 1 a 5 etiquetas únicas obligatorias desde Fase 3.

Podrá incluir comunidad y prompt en sus fases correspondientes.
El 2026-10-15 se aprobó adelantar creación, edición y visualización de
hashtags a Fase 3, sin búsqueda ni navegación por hashtag hasta Fase 5.
Cada etiqueta tendrá de 2 a 30 caracteres Unicode (letras, números o
guion bajo), en minúsculas y forma NFC, sin espacios; el prefijo `#`
de entrada no se almacena. La cantidad se valida después de normalizar
y eliminar duplicados. Una publicación sin etiquetas válidas no se publica.

### RF-05 CRUD de publicaciones

El propietario podrá crear, consultar, modificar y eliminar sus
publicaciones.

Contrato aprobado para Fase 3 el 2026-10-15: título obligatorio de 1–120
caracteres tras trim, descripción opcional de hasta 2000; imagen JPEG, PNG
o WebP estático de hasta 5 MiB y 4096 píxeles por eje, normalizada sin
metadatos. Publicaciones confirmadas públicas sin sesión; cargas pendientes
privadas, entrega desde bucket privado mediante URLs firmadas de corta
duración. Todos los roles editan/eliminan solo contenido propio en esta fase.

### RF-06 Categorías

Las publicaciones deberán poder clasificarse por categorías.

Categorías iniciales:

-   Historia
-   Ciencia
-   Arte
-   Tecnología
-   Matemáticas

### RF-07 Comunidades

Los usuarios podrán explorar y participar en comunidades temáticas.

### RF-08 Búsqueda

El sistema deberá permitir buscar publicaciones por título, descripción,
etiquetas, categoría, comunidad y autor.

### RF-09 Filtros

El sistema deberá permitir filtrar publicaciones por criterios definidos
por producto.

### RF-10 Likes

Un usuario podrá dar y quitar un like por publicación.

En Fase 4 se permite también sobre publicaciones propias. La mutación exige
sesión y perfil y recibe el estado deseado, no un toggle: repetirla no
duplica ni invierte el resultado. Los conteos son públicos; la relación
personal solo es legible por su titular, sin listas públicas de likes.

### RF-11 Comentarios

Un usuario autenticado podrá comentar publicaciones. Podrá eliminar sus
propios comentarios.

Contrato de Fase 4: texto plano de 1–1000 puntos de código Unicode tras
trim, sin interpretar HTML/Markdown, envío con UUID idempotente y lectura
pública en páginas de 12, recientes primero con cursor `(created_at, id)`.
Eliminar exige confirmación y permite cancelar; ni el autor del post ni
roles elevados pueden borrar comentarios ajenos en esta fase.

### RF-12 Compartir

El sistema deberá permitir copiar/compartir el enlace de una publicación
y, en Fase 4, no registrará eventos ni métricas. También lo podrá usar un
anónimo. Se ofrecerá copia y compartir nativo cuando esté disponible,
distinguiendo cancelación, fallo y éxito. El enlace apunta al detalle,
con origen configurado por entorno (localhost solo en desarrollo), nunca
a una URL firmada de imagen.

### RF-13 Seguimiento

Un usuario podrá seguir a otro usuario, excepto a sí mismo.

En Fase 4 requiere sesión y perfil, usa estado deseado idempotente y
destino estable por ID de perfil aunque cambie el username. Solo se
publican conteos en perfiles y el estado propio para su titular, no listas
de relaciones. No se personaliza el feed. Entre pestañas prevalece la
última operación confirmada; se reconcilia al volver a la pestaña o recargar.

### RF-14 Ranking

El sistema deberá ofrecer rankings de publicaciones y/o usuarios. La
fórmula exacta será definida en una etapa posterior.

### RF-15 Recomendaciones

El sistema deberá ofrecer contenido recomendado utilizando inicialmente
señales simples como categorías, comunidades, interacciones, usuarios
seguidos y popularidad.

### RF-16 Medallas

El sistema deberá otorgar medallas según condiciones definidas.

### RF-17 Reportes

Los usuarios podrán reportar publicaciones, comentarios o usuarios.

### RF-18 Administración

El administrador deberá disponer de herramientas para gestionar
usuarios, publicaciones, comunidades, categorías, medallas y reportes.

## 5. Requisitos no funcionales

### RNF-01 Usabilidad

La interfaz deberá ser clara y adecuada para estudiantes y docentes.

### RNF-02 Responsive

La aplicación deberá adaptarse a escritorio, tablet y móvil.

### RNF-03 Rendimiento

Las imágenes deberán optimizarse y la carga de contenido deberá utilizar
paginación o carga incremental cuando corresponda.

### RNF-04 Seguridad

Los datos y acciones deberán protegerse mediante autenticación,
autorización y políticas RLS.

### RNF-05 Mantenibilidad

El código deberá estar organizado en componentes y módulos
reutilizables.

### RNF-06 Accesibilidad

Se deberán contemplar contraste, textos alternativos, navegación por
teclado, jerarquía semántica y estados visibles de interacción.

## 6. Reglas de negocio

-   Solo usuarios autenticados pueden crear publicaciones.
-   Un usuario solo puede editar sus propias publicaciones.
-   Un usuario solo puede eliminar sus propias publicaciones, salvo
    permisos de moderación.
-   Un usuario no puede darse like a sí mismo más de una vez sobre la
    misma publicación.
-   Un usuario puede quitar su like.
-   Un usuario no puede seguirse a sí mismo.
-   Una publicación debe tener imagen, título y categoría.
-   Los roles determinan permisos.
-   Las medallas se asignan cuando se cumplen sus condiciones.

## 7. Fuera del MVP

-   Generación de imágenes mediante IA integrada en VIA.
-   Chat privado.
-   Videollamadas.
-   Monetización.
-   Aplicación móvil nativa.
-   Machine learning propio para recomendaciones.
-   Evaluación automática de calidad pedagógica.

## 8. Criterios de aceptación del MVP

El MVP será aceptable cuando un usuario pueda autenticarse, crear y
administrar publicaciones, explorar contenido, interactuar mediante
likes y comentarios, utilizar categorías y comunidades básicas, y cuando
los permisos de usuario, moderador y administrador estén correctamente
aplicados.
