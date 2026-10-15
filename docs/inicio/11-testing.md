# VIA --- Estrategia de testing

## 1. Objetivo

Garantizar que el sistema funcione correctamente y que los permisos no
puedan ser evadidos.

## 2. Pruebas unitarias

Para funciones aisladas:

-   Validadores.
-   Cálculos de ranking.
-   Reglas de medallas.
-   Utilidades.
-   Transformaciones de datos.

## 3. Pruebas de integración

Validar:

-   Server Actions + Supabase.
-   Autenticación + rutas.
-   Publicaciones + Storage.
-   Likes + base de datos.
-   Comentarios + publicaciones.

## 4. Pruebas end-to-end

Flujos prioritarios:

### E2E-01

Registro/login -\> inicio.

### E2E-02

Login -\> crear publicación -\> visualizar publicación.

### E2E-03

Usuario A -\> publicar -\> usuario B -\> like.

### E2E-04

Usuario A -\> publicar -\> usuario B -\> comentar.

### E2E-05

Usuario -\> editar publicación propia.

### E2E-06

Usuario -\> intentar editar publicación ajena -\> acceso rechazado.

### E2E-07

Usuario -\> acceder a `/admin` -\> acceso rechazado.

### E2E-08

Administrador -\> acceder a `/admin` -\> acceso permitido.

## 5. Seguridad

Las pruebas deberán comprobar que las restricciones también se cumplen
directamente en Supabase/RLS, no solamente en la interfaz.

## 6. Criterio de aceptación

### Contrato adicional de publicaciones — Fase 3

- Hashtags (`VIA-037`): cantidades 1 y 5 válidas, 0 y 6 rechazadas;
  longitudes 2 y 30 válidas, 1 y 31 rechazadas, medidas en puntos de código
  tras normalización NFC. Probar tildes/ñ, equivalencia Unicode compuesta
  y descompuesta, mayúsculas, prefijo `#`, duplicados y caracteres inválidos.
- Un hashtag inválido no se descarta silenciosamente. Crear/editar con
  error conserva valores y no modifica parcialmente metadata o imagen.
  La cantidad se evalúa después de deduplicar valores canónicos.
- Repetir el contrato en escrituras PostgreSQL directas y comprobar que
  cambiar etiquetas propias actualiza feed y detalle tras recarga.
  Un tercero o un rol elevado no puede cambiar etiquetas ajenas en Fase 3.
- Imagen: límites exactos de 5242880 bytes y 4096 píxeles por eje, siguiente
  byte/píxel rechazado, MIME falso, animación y contenido ilegible.
- Lectura: cargas pendientes privadas, publicaciones confirmadas públicas;
  probar URL directa, firma y vencimiento de 60 segundos, no solo RLS de
  metadata. No guardar firmas en base ni permitir caché que prolongue acceso.
- Paginación con timestamps iguales y desempate por ID; reintento con misma
  operación sin duplicados, payload cambiado con conflicto, edición obsoleta
  rechazada y limpieza parcial observable después de borrar.
- Estos son casos requeridos, no pruebas de publicaciones ya ejecutadas.

Una funcionalidad no se considera terminada si solo funciona en el caso
exitoso. Deben probarse también errores, permisos y datos inválidos.
