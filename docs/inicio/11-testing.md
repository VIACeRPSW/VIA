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
- La evidencia ejecutada y los casos ampliados aún abiertos se distinguen
  en la [revisión de cierre de Fase 3](../fases/fase03.md#revisión-de-cierre--2026-10-15).
  Las casillas compuestas no se aprueban con un único caso exitoso.

Pruebas de publicaciones existentes:

- `e2e/post-publishing.spec.ts`: CRUD completo con archivo de 5 MiB,
  feed continuo, galería de 12/1, edición/reemplazo y borrado confirmado.
- `e2e/post-closure.spec.ts`: segundo usuario, permisos reales de Storage,
  teclado y responsive, interrupción de envío y vencimiento de firma antes
  de limpiar el objeto retirado.
- `e2e/profile-onboarding.spec.ts`: la comprobación de JWT vencido también
  recorre crear, galería propia y edición de publicaciones.
- Los casos de fallos de repositorio simulados en Vitest y los metadatos
  Storage en transacciones SQL no se presentan como inyección de fallos
  de red en el servicio remoto. La base existente no se resetea para probar.

Una funcionalidad no se considera terminada si solo funciona en el caso
exitoso. Deben probarse también errores, permisos y datos inválidos.

### Interacción — Fase 4, incremento de likes

- `actions/post-likes.test.ts`: entrada estricta, sesión/perfil, estado
  deseado repetido, confirmación autoritativa, errores redactados y RPC de
  lectura de hasta 12 posts sin consultas por tarjeta.
- `components/posts/post-likes.test.tsx`: estado accesible, conteo real,
  carga/error sin cero ficticio, login anónimo y perfil incompleto.
- `supabase/tests/post_likes.sql`: fixtures A/B/anónimo/sin perfil,
  moderador/admin sin acceso ajeno, unicidad, grants, cascada al borrar
  post y conservación de perfiles/journal. Termina con rollback; los
  metadatos de imagen de esta prueba no equivalen a subir un objeto real.
- `e2e/post-likes.spec.ts`: usuarios e imágenes reales efímeros; ocho
  peticiones iguales concurrentes sin duplicación, persistencia, unlike,
  fallo antes de enviar y respuesta perdida después de confirmar, reintento,
  lectura anónima, scroll, aislamiento tras cambio de sesión, recuperación
  de foco, teclado y 360/768/1280. Mide un lote de 12 al entrar al feed
  y otro solo de IDs nuevos tras scroll; cada lote tiene como máximo 12.
  Un JWT malformado se prueba contra la API real, no como JWT vencido.
- No se declara probado el rollback/reaplicación del esquema ni un JWT
  realmente vencido de este incremento. El E2E observó avisos de desarrollo
  de Clerk/Realtime y streams cancelados al cambiar sesión, sin aserciones
  fallidas; no se presentan como una validación adicional de expiración.
- Evidencia y casillas compuestas en
  [Fase 4](../fases/fase04.md#sprint-12--likeunlike-con-estado-y-conteo-reales).
- El usuario aprobó su funcionamiento manual y difirió explícitamente
  JWT vencido y rollback/reaplicación de likes para avanzar a comentarios.

### Interacción — Sprint 2.1 de comentarios

- `lib/posts/comment-contract.test.ts`, `actions/post-comments.test.ts` y
  `lib/posts/read-comments.test.ts`: límites 0/1/999/1000/1001 por puntos
  de código, emoji, trim Unicode, NUL/surrogates inválidos, IDs/actor,
  idempotencia/conflicto, proyección, cursor, errores redactados y conteos
  por lote sin convertir un fallo en cero.
- `components/posts/post-comments.test.tsx` y pruebas de presentación/lectura
  del feed: HTML como texto inerte, formulario etiquetado, lectura anónima,
  vacío distinto de fallo y galerías sin consultas/controles de comentarios.
- `npm run test:db:comments`: fixtures A/B/anónimo/sin perfil/moderador/admin,
  protección de columnas, 26 comentarios en tres páginas con empates exactos
  y microsegundos, conflicto por UUID, token sin expiración/inválido/vencido,
  cascada al retirar post y conservación de perfiles, otro post y journal.
  Prueba el rechazo del rollback con datos y compara seis funciones,
  RLS, grants, trigger y política tras retirada/reaplicación en transacción.
  Normaliza CRLF a LF antes de comparar definiciones, sin omitir contenido.
- `e2e/post-comments.spec.ts`: seis envíos concurrentes de una operación
  crean un solo comentario; 1000 emoji válidos, 1001 rechazados, B comenta A,
  autor público y contador correctos, respuesta perdida después del commit,
  reintento sin duplicados, fallo/reintento de paginación conservando borrador,
  HTML inerte, lectura anónima, perfil ausente, teclado y 360/768/1280.
  Un token real congelado se acepta vigente y se rechaza tras vencer; el
  conteo no cambia. Al borrar el post desaparecen comentarios y se limpia
  la imagen. Usuarios Clerk y filas temporales se retiran en `finally`.
- Primera ejecución: el servicio aceptó una escritura después de `exp`.
  Se añadió una migración correctiva para comprobar expiración en la
  política/trigger y se repitieron SQL y E2E, esta vez aprobados. Los errores
  de red registrados en el recorrido final corresponden a fallos inyectados.
- No se probaron aún controles de eliminación individual de comentarios,
  que corresponden al Sprint 2.2. Tampoco se ejecutó una regresión integral
  ni se retomaron las dos comprobaciones de likes diferidas por el usuario.
