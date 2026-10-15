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

En Fase 3, `/inicio` muestra tarjetas en columna única con carga continua
al bajar y botón alternativo de carga/reintento. Incluye imagen, título,
autor, descripción, categoría y hashtags de texto. Las galerías propias en
`/imagenes` y públicas por autor muestran solo fotos con enlace accesible
al detalle; no presentan títulos ni descripciones visibles en el grid.
El perfil propio enlaza a «Mi galería», sin duplicar esa vista.

La tarjeta social completa añadirá las interacciones en Fase 4:

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

Fase 4 envía el estado deseado, no un toggle remoto. Exige sesión/perfil,
permite likes propios y confirma estado/conteo antes de actualizar la UI.
Reintentar el mismo estado no duplica ni invierte. Los conteos admiten
lectura anónima, nunca listas de personas; el estado propio es privado.
Al volver a una pestaña o recargar se reconcilia con el servidor.

## 5. Comentario

``` text
Usuario
 -> escribe comentario
 -> validar
 -> Server Action
 -> insertar
 -> actualizar publicación
```

Texto plano de 1–1000 puntos de código tras trim, envío idempotente por
UUID, lectura pública paginada de 12 recientes con cursor estable. Fallar
conserva el borrador; eliminar requiere ser autor, confirmar y poder
cancelar. Autor del post y roles elevados no moderan comentarios en Fase 4.

### Compartir y seguir en Fase 4

Compartir admite anónimos y apunta al detalle con origen configurado por
entorno (localhost solo en desarrollo). Copia y opción nativa sin eventos
ni métricas; cancelar no se informa como éxito.

Seguir/dejar de seguir requiere perfil y sesión, no permite seguirse a sí
mismo y usa el ID estable del destino aunque cambie su username. Se muestran
conteos en perfiles y estado propio, sin listas ni personalización del feed.

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
