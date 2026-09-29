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

Podrá incluir comunidad, etiquetas y prompt.

### RF-05 CRUD de publicaciones

El propietario podrá crear, consultar, modificar y eliminar sus
publicaciones.

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

### RF-11 Comentarios

Un usuario autenticado podrá comentar publicaciones. Podrá eliminar sus
propios comentarios.

### RF-12 Compartir

El sistema deberá permitir copiar/compartir el enlace de una publicación
y podrá registrar el evento.

### RF-13 Seguimiento

Un usuario podrá seguir a otro usuario, excepto a sí mismo.

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
