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

Debe mostrar:

``` text
Imagen
Título
Autor
Descripción
Like
Comentarios
Compartir
```

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
