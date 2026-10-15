# VIA --- UI/UX

## 1. Referencia visual

El prototipo inicial presenta:

-   Navegación superior.
-   Buscador.
-   Chips de categorías.
-   Tarjetas de publicaciones.
-   Comunidades populares.
-   Miembros destacados.
-   Ranking.
-   Medallas.
-   Recomendaciones.
-   Acción para crear contenido.

## 2. Navegación principal

``` text
VIA
Inicio
Comunidades
Mis imágenes
Ranking
Perfil
Crear
```

## 3. Inicio

La página deberá priorizar:

1.  Descubrimiento.
2.  Búsqueda.
3.  Publicaciones.
4.  Interacción.

## 4. Tarjeta de publicación

Diseño de Fase 3 aprobado visualmente el 2026-10-15:

- `/inicio`: feed en columna única a todos los anchos, con autor, imagen
  grande, título, descripción, categoría y hashtags de texto. Carga continua
  al bajar, con botón alternativo de carga/reintento para teclado.
- `/imagenes` y galería pública por autor: grid de fotos cuadradas sin
  títulos, descripciones ni datos de autor visibles en los tiles. Cada imagen
  conserva texto alternativo y un enlace con nombre accesible al detalle.
- `/perfil` enlaza a «Mi galería»; no se duplica el grid dentro del perfil.
- Editar y eliminar se ofrecen en el detalle propio, no sobre las fotos del
  grid. El borrado exige confirmación y permite cancelar sin cambios.

La tarjeta social del producto completo incorporará en Fase 4:

``` text
Imagen
Título
Autor
Descripción
Like
Comentarios
Compartir
```

Contratos aprobados de Fase 4: likes en feed/detalle, nunca sobre los
tiles de galerías. Botón con `aria-pressed`, pendiente, contador real,
foco visible y error recuperable, sin éxito optimista no confirmado.
Anónimo ve conteos y acceso a login; sin perfil se invita a completarlo.
Comentarios en detalle, texto plano, páginas de 12 recientes y borrador
conservado al fallar. Borrar solo el propio exige confirmar o cancelar.
Compartir en feed/detalle ofrece copia y opción nativa, sin métricas y
con cancelación distinta de éxito. Seguir solo en perfil público ajeno;
conteos de seguidores/seguidos en perfiles, sin listas ni feed personalizado.
El diseño aprobado se conserva; cada control se habilita al implementar
su incremento, no como promesa de una función inexistente.

## 5. Crear

La pantalla deberá reducir fricción:

``` text
Imagen
Título
Descripción
Categoría
Comunidad (opcional)
Hashtags (obligatorios, de 1 a 5)
Publicar
```

En Fase 3, cada hashtag admite 2–30 caracteres conforme a
[RF-04](01-ers.md). El formulario informa límites, errores y normalización,
conserva valores inválidos para corregirlos y permite editar las etiquetas.
Las tarjetas y el detalle muestran hashtags como texto, sin enlaces ni
botones de búsqueda ficticios. Comunidad no se muestra como control activo
hasta Fase 5.

## 6. Responsive

El feed aprobado de Fase 3 permanece en una columna; las galerías conservan
el grid solo-imágenes. Las reglas generales siguientes no autorizan cambiar
ese diseño ni añadir controles sociales antes de Fase 4.

En móvil:

-   La navegación deberá adaptarse.
-   Las tarjetas podrán pasar a una columna.
-   Los controles táctiles deberán tener tamaño suficiente.
-   El contenido lateral podrá convertirse en secciones inferiores o
    carruseles.

## 7. Accesibilidad

-   Texto alternativo.
-   Labels en formularios.
-   Foco visible.
-   Contraste suficiente.
-   Estados de error claros.
-   No depender exclusivamente del color.
-   HTML semántico.

## 8. Identidad visual

La interfaz deberá transmitir:

-   Educación.
-   Creatividad.
-   Tecnología.
-   Comunidad.

El prototipo utiliza una estética limpia, moderna y colorida. La
implementación deberá conservar la idea visual sin quedar limitada a una
copia exacta del prototipo.
