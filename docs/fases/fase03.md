# VIA — Fase 03: Publicaciones

## Estado

- Estado: Cerrada por decisión del usuario el 2026-10-15 — CRUD y diseño aprobados; comprobaciones ampliadas no ejecutadas diferidas explícitamente, sin marcarlas aprobadas
- Roadmap: Fase 3
- Dependencias: cierre verificable de Fase 2; perfiles propios y proyección pública segura; autenticación Clerk → Supabase bajo RLS; Supabase PostgreSQL y Storage disponibles; aprobación de los contratos y diferencias con los wireframes en el Sprint 1.1.
- Criterio de salida: CRUD completo de publicaciones con imagen persistente, listado, detalle, edición y eliminación propias, permisos equivalentes en aplicación, PostgreSQL y Storage, y vistas responsive comprobadas.
- Restricción: el usuario autorizó continuar la fase tras confirmar el cierre de Fase 2. El Sprint 1.1 resuelve contratos antes de implementar; las operaciones remotas, migraciones y despliegues requieren autorización específica.

Las casillas de alcance/tareas indican implementación comprobada, no aprobación
automática de todos los CA. Las pruebas compuestas permanecen abiertas cuando
falta alguno de sus casos; su cobertura parcial se detalla en la revisión de
cierre. La aprobación visual del usuario conserva el diseño, pero no sustituye
las comprobaciones técnicas. No hay un despliegue nuevo confirmado.

## Objetivo

Construir el flujo de publicaciones de VIA tomando como referencia visual [Proyecto](../Proyecto.md) y respetando la Fase 3 del [roadmap](../inicio/12-roadmap.md). Una persona con perfil podrá subir una imagen educativa, publicar sus datos, verla en el feed, abrir su detalle y administrar sus publicaciones desde el perfil y la galería propia.

La comprobación seguirá el orden identidad y perfiles → contratos → esquema y RLS → Storage → creación → lectura y vistas → edición → eliminación → regresión integral. Ningún sprint se cerrará solo por una captura o por un caso exitoso de interfaz.

### Punto de partida comprobado el 2026-10-14

| Fuente | Situación documentada y observada | Consecuencia |
| --- | --- | --- |
| [Fase 1](fase01.md) | Completada; evidencia registrada de autenticación, conexión, RLS, rollback y despliegue autorizado. | Reutilizar la base existente; no repetir su implementación. La evidencia histórica no demuestra disponibilidad actual del remoto. |
| [Fase 2](fase02.md) | En curso. Sprints 1.1, 1.2 y 2.1 completados; Sprint 2.2 implementado y en validación manual y de retirada aislada del bucket; 3.1 pendiente. | Cerrar avatar y autorización integral en Fase 2; no iniciar el CRUD. |
| [Perfil actual](../../app/perfil/page.tsx) | Presenta datos persistentes, perfil público, edición propia y avatar validado con carga, reemplazo y retirada desde edición. Deriva al alta cuando falta perfil; no incluye galería. | Cerrar primero el sistema de usuarios; añadir publicaciones aquí solo en Fase 3. |
| [Migraciones](../../supabase/migrations/) | Cinco migraciones: cuatro de perfiles y una de bucket público `avatars`, RLS y journal privado de limpieza. No hay esquema ni bucket de publicaciones. | No dar por existentes `posts`, `categories`, `communities` o Storage de publicaciones. |
| [Cliente servidor](../../lib/supabase/server.ts) | Usa clave publicable y token Clerk con template `supabase`, sin credenciales administrativas para operaciones ordinarias. | Mantener este límite de privilegios y comprobar la frontera de identidad antes de añadir operaciones. |

La revisión inicial fue local y documental. La actualización de estado de Fase 2 del 2026-10-14 incorpora consultas reales por Supabase MCP, una migración de lectura pública autorizada y pruebas locales/remotas y E2E con fixtures efímeros. No se implementaron publicaciones ni se desplegó en Vercel; el cierre de Fase 2 sigue siendo una dependencia.

## Trazabilidad

| Fuente | Elementos cubiertos |
| --- | --- |
| Roadmap | Storage → Sprint 2.1; crear publicación → 2.2; listar y detalle → 3.1; editar → 4.1; eliminar → 4.2; salida CRUD completo → 5.1. Sprint 1.1 controla dependencias y 1.2 prepara las garantías de datos. |
| Backlog | `VIA-009` → 2.1; `VIA-010` → 2.2; `VIA-011`, `VIA-012` → 3.1; `VIA-013` → 4.1; `VIA-014` → 4.2. `VIA-004`, `VIA-005` se reutilizan para esquema/RLS de publicaciones en 1.2, sin reabrir la base ya cerrada. |
| Ampliación 2026-10-15 | `VIA-037`: hashtags obligatorios → contrato 1.1, garantías de datos 1.2, creación 2.2, lectura 3.1 y edición 4.1. Búsqueda/navegación por hashtag permanece en Fase 5. |
| Requisitos | `RF-03`, `RF-04`, `RF-05`; `RF-02` solo para publicaciones en perfil; `RF-06` solo como referencia obligatoria de categoría; `RNF-01` a `RNF-06`; reglas de propiedad de la ERS; [modelo de datos](../inicio/04-modelo-datos.md), [seguridad](../inicio/05-seguridad-y-autorizacion.md), [arquitectura](../inicio/03-arquitectura.md), [acciones](../inicio/08-api-y-server-actions.md), [UI/UX](../inicio/09-ui-ux.md) y [testing](../inicio/11-testing.md). |
| Proyecto | Pantallas 3, 4 y 5 → 2.2 y 3.1; galería y acciones de pantalla 7 → 3.1, 4.1 y 4.2. Pantallas 1 y 2 se conservan; 6 y 8 se trazan como diferidas, no implementadas. |

### Cobertura de las ocho vistas diseñadas

| Pantalla de Proyecto | Ruta de referencia → ruta base | Comprobación y fase responsable |
| --- | --- | --- |
| 1. Splash / bienvenida | `/` → `/` | Conservar marca, slogan y accesos de Fase 1; comprobar navegación y regresión en 3.1 y 5.1. No rehacer la portada. |
| 2. Login / registro | `/login`, `/register` → `/sign-in`, `/sign-up` | Conservar Clerk y Google existentes; comprobar retorno a la operación solicitada y logout en 5.1. Alias y selección Estudiante/Docente requieren decisión; no cambiar autenticación aquí. |
| 3. Home / feed | `/home` → `/inicio` | Imagen, título, autor y publicaciones recientes paginadas en 3.1. Hashtags destacados, buscador y comunidad quedan diferidos a Fase 5; no mostrar controles falsamente funcionales. |
| 4. Crear / publicar | `/crear` → `/crear` | Selector de imagen y formulario en 2.1 y 2.2. Categoría y entre 1 y 5 hashtags obligatorios según ERS actualizada el 2026-10-15; comunidades permanecen en Fase 5. |
| 5. Vista individual | `/post/:id` → `/post/[id]` | Imagen, autor público, título, descripción y retorno en 3.1; acceso a resolución original sujeto al mismo permiso que el detalle. Hashtags clicables diferidos a Fase 5. |
| 6. Búsqueda y hashtags | `/buscar` → ruta por acordar con `/explorar` | Fase 5: `VIA-024`, `VIA-025`; búsqueda por hashtag no tiene identificador específico existente. Esta fase solo documenta el destino, sin crear pantalla, filtros ni conteos ficticios. |
| 7. Perfil | `/perfil` → `/perfil`; galería propia `/imagenes` | Datos y avatar dependen del cierre de Fase 2. Galería y conteo real de publicaciones en 3.1; editar/eliminar propias en 4.1 y 4.2. Perfil público conserva `/usuario/[username]`. |
| 8. Administración / moderación | `/admin` → `/admin` | Fase 7: `VIA-032`, `VIA-033`, `VIA-034`, `VIA-035`. No crear panel ni adelantar mutaciones de moderación; el rol no se obtiene del formulario. |

## Fuera de alcance

- Resolver los sprints pendientes de Fase 2 dentro de esta fase o marcarla completada por anticipado.
- Likes, comentarios, compartir y seguimiento: Fase 4. Los wireframes de detalle de solo lectura no eliminan esos requisitos futuros.
- Gestión de categorías, comunidades, membresías, búsqueda, filtros y hashtags navegables: Fase 5. El catálogo mínimo requerido por `category_id` no equivale a completar `VIA-023`.
- Ranking, medallas y estadísticas sociales: Fase 6. Solo el conteo real de publicaciones de una galería corresponde a esta fase.
- Panel administrativo, gestión de roles, reportes y moderación: Fase 7.
- Generación de imágenes con IA: fases posteriores. Aquí se suben imágenes existentes.
- Nuevos proveedores de acceso, Clerk Production, dominio propio, cambios remotos y despliegues no autorizados.
- Edición o eliminación de perfiles, categorías y comunidades desde el CRUD de publicaciones.

## Riesgos y decisiones

| Tipo | Descripción | Mitigación o decisión requerida |
| --- | --- | --- |
| Dependencia resuelta 2026-10-15 | Fase 2 completada con evidencia automatizada y confirmación manual del usuario. | Cierre enlazado en Sprint 1.1; habilita resolver contratos, no autoriza por sí solo cambios remotos. |
| Decisión aprobada 2026-10-15 | El usuario adelanta solo hashtags a Fase 3 y exige al menos uno además de categoría obligatoria. | Entre 1 y 5 hashtags únicos de 2–30 caracteres; letras Unicode, números y guion bajo, minúsculas/NFC, sin espacios y sin `#` almacenado. Creación, edición y visualización en esta fase; búsqueda/navegación y comunidades en Fase 5. ERS, alcance, modelo, acciones, UI, roadmap y backlog (`VIA-037`) actualizados. |
| Alcance preservado | Proyecto llama rol a Estudiante/Docente, pero los permisos existentes usan `user`, `moderator`, `admin`. | No incorporar un atributo educativo ni privilegios nuevos en este CRUD; conservar roles persistidos y rutas Clerk. |
| Decisión aprobada 2026-10-15 | Rutas y lectura pública. | `/inicio` y `/post/[id]` públicos; `/crear`, `/imagenes` y `/post/[id]/editar` privados. Portada, acceso y perfil conservados sin aliases. |
| Decisión aprobada 2026-10-15 | Categoría obligatoria y catálogo mínimo. | Historia, Ciencia, Arte, Tecnología y Matemáticas; comunidades, `community_id` y FK diferidos a Fase 5. |
| Decisión aprobada 2026-10-15 | Límites de contenido e imagen. | Título 1–120 tras trim; descripción opcional 0–2000; JPEG/PNG/WebP estáticos hasta 5 MiB y 4096 por eje, normalizados sin metadatos. Contrato operativo detallado debajo. |
| Riesgo | Un bucket público puede revelar cargas pendientes, publicaciones retiradas o archivos borrados solo en metadata. | Definir primero la visibilidad. Propuesta: lectura pública solo de publicaciones confirmadas y objetos asociados; cargas pendientes privadas. No suponer que RLS de tablas protege URLs públicas; definir entrega y caducidad de URLs firmadas cuando correspondan. |
| Riesgo | La autoría utiliza `profiles.id`, mientras Storage y Clerk reconocen el `sub` textual. | Resolver el perfil en servidor, derivar rutas del `sub` y probar la asociación; no aceptar `user_id`, propietario, estado ni URL externa del formulario. |
| Riesgo | Probar un feed público mediante joins podría ampliar lectura de perfiles privados. | Consumir únicamente la proyección pública de Fase 2; verificar también REST/RPC directo, no solo tipos o UI. |
| Riesgo | Escribir metadata y objetos no es una única transacción; reintentos, edición o eliminación pueden dejar residuos. | Definir idempotencia, compensación y recuperación observable antes del upload. No informar éxito de limpieza cuando haya tareas pendientes; verificar residuos por sprint. |
| Decisión aprobada 2026-10-15 | Propiedad uniforme para todos los roles. | `user`, `moderator` y `admin` solo editan/eliminan publicaciones propias en Fase 3. Mutaciones ajenas privilegiadas y panel permanecen en Fase 7. |
| Dependencia externa | Supabase y Clerk pueden haber cambiado desde las pruebas de septiembre/octubre; Preview y Production comparten temporalmente servicios. | Revalidar en entorno autorizado sin datos reales; probar objetos en entorno aislado. SQL reversible no revierte objetos Storage. No ejecutar reset o rollback destructivo contra el remoto compartido. |
| Dependencia externa | Vercel requiere configuración compatible para servir imágenes y retornar desde autenticación. | Validar local primero; Preview/Production solo con autorización explícita, sin versionar secretos ni URLs firmadas de usuarios. |

## Hito 1 — Dependencias y barrera de datos comprobables

### Actualización de dependencias — 2026-10-15

La [Fase 2](fase02.md) está completada: 164 pruebas Vitest, cuatro E2E
Chromium, tipos, lint, build, escaneo del cliente y matrices RLS/Storage
superadas. El usuario confirmó revisión manual accesible, retirada aislada
del bucket y flujo Google desplegado. La confirmación externa está
identificada expresamente como tal en el cierre de Fase 2.
El punto de partida y los riesgos anteriores se conservan como historial:
el bloqueo por usuarios queda resuelto; las decisiones de publicaciones
siguen pendientes hasta aprobación. No se ha creado esquema ni CRUD.

### Contrato de hashtags aprobado — 2026-10-15

El usuario decide adelantar solo hashtags, no comunidades; exige categoría
y al menos un hashtag. Aprueba de 1 a 5 etiquetas únicas, de 2 a 30
caracteres por etiqueta, con letras Unicode, números y guion bajo, sin
espacios ni signos adicionales. Se normalizan a minúsculas y NFC,
preservando tildes y `ñ`; el `#` inicial es opcional al escribir y no se
almacena. Se deduplica después de normalizar y se valida entonces la
cantidad. No se descartan etiquetas inválidas silenciosamente.

La ampliación cubre alta, edición, persistencia y presentación como texto.
No incluye links, página de hashtag, buscador, tendencias ni contadores.
Las restricciones de escritura directa deben garantizar el mismo contrato
que la acción; los hashtags y los otros campos se confirman atómicamente.
Su representación SQL se fijará en 1.2. No se crea todavía código ni migraciones en este sprint documental.

### Contrato operativo cerrado — 2026-10-15

- Rutas aprobadas: `/inicio` y `/post/[id]` públicos; `/crear`, `/imagenes`
  y `/post/[id]/editar` privados. Se conservan portada, autenticación y
  perfiles existentes; no aliases ni cambio de retorno global de Clerk.
- Campos aprobados: título 1–120 tras trim, descripción opcional 0–2000,
  categoría obligatoria del catálogo inicial aprobado y hashtags del
  contrato anterior. Comunidad y prompt no se ofrecen en este formulario.
  ID, autor, estado, timestamps y referencia de Storage no son editables.
- Imagen aprobada: JPEG, PNG o WebP estáticos, 1–5242880 bytes inclusive,
  1–4096 píxeles por eje. Verificar MIME/contenido, rechazar animación,
  SVG y archivo ilegible. Normalizar a WebP sin metadatos ni ampliación;
  el resultado almacenado también debe respetar 5 MiB y 4096 por eje.
- Visibilidad aprobada: publicaciones confirmadas públicas sin sesión,
  bucket `posts` privado, cargas pendientes solo del propietario. Persistir
  `image_path` canónico, nunca una URL firmada. Entrega con firma de 60
  segundos, sin caché que prolongue la autorización ni credenciales admin.
  Antes de firmar se comprueba visibilidad; una URL ya emitida puede durar
  hasta expirar. No se prometen revocaciones de copias descargadas.
- Propiedad aprobada: anónimo lee solo contenido confirmado; A crea con
  perfil propio y edita/elimina solo A; B no modifica A. Moderador/admin
  se comportan como propietarios ordinarios, sin excepción ajena. Formularios,
  acciones directas, REST/RPC y Storage deben aplicar la misma matriz.
- Parámetros técnicos: feed reciente con cursor `(created_at, id)`
  descendente, 12 elementos por página, sin paginación offset. Autor público
  con username, nombre visible y avatar seguro, sin identidad Clerk ni ID
  privado del perfil. No se publican cargas pendientes ni retiradas.
- Operación UUID vinculada a propietario y payload para idempotencia;
  repetición devuelve el mismo resultado, payload distinto da conflicto.
  Versión esperada en edición y confirmación explícita en borrado. Solo
  filas completas `published` son públicas; cargas y cleanup son operativos
  privados con lease de 10 minutos y recuperación invocada por propietario.
  El borrado retira lectura primero y limpia objeto después; un fallo
  produce aviso y reintento, nunca éxito de limpieza ficticio.
- Límites y errores se prueban exactamente en TypeScript y PostgreSQL,
  incluyendo Unicode y escrituras directas. Error de campo, sesión,
  conflicto/idempotencia, edición obsoleta, 404, indisponibilidad y cleanup
  pendiente se distinguen sin filtrar identificadores privados.

### Sprint 1.1 — Cierre previo y contrato aprobado

**Objetivo:** disponer de evidencia del cierre de usuarios y decisiones aprobadas antes de escribir el CRUD.

**Alcance**

- [x] Verificación documental del cierre de Fase 2, sin absorber su trabajo.
- [x] Contrato aprobado de rutas, campos, imagen, visibilidad, categoría y permisos.
- [x] Matriz de vistas actuales, incrementos y elementos diferidos.

**Tareas**

- [x] `Sin identificador existente` Confirmar cierre de Fase 2 y enlazar sus evidencias; si sigue abierta, registrar bloqueo y detener el avance a 1.2.
- [x] `Sin identificador existente` Aprobar o resolver las decisiones pendientes de esta fase; actualizar documentos base afectados antes de implementar.
- [x] `VIA-010` Especificar campos, normalización, límites, obligatoriedad, estados publicables, errores y clave de idempotencia.
- [x] `VIA-009` Definir formatos, bytes y dimensiones máximos, validación real de contenido, rutas, visibilidad, recuperación y borrado de archivos.
- [x] `VIA-011` Acordar lectura pública/privada, orden reciente con desempate por ID, tamaño de página y proyección pública de autor.
- [x] `VIA-013` `VIA-014` Fijar matriz de propiedad y permisos directos; definir ruta de edición propuesta `/post/[id]/editar` y confirmación de borrado.
- [x] `Sin identificador existente` Aprobar catálogo mínimo de categorías; comunidades, búsqueda y navegación por hashtags permanecen en Fase 5. Alta/edición/visualización de hashtags obligatorios aprobadas para esta fase (`VIA-037`).

**Criterios de aceptación**

- [x] CA-1.1.1 — Fase 2 está cerrada con evidencia, o el bloqueo impide expresamente comenzar 1.2.
- [x] CA-1.1.2 — No quedan decisiones abiertas necesarias para esquema, Storage o CRUD; contrato y documentos base son coherentes.
- [x] CA-1.1.3 — Las ocho pantallas tienen destino y fase responsable, sin controles prometidos que no se implementarán.

**Pruebas**

- [x] P-1.1.1 — Unitarias: no aplica; se aprueban contratos, sin código (CA-1.1.2).
- [x] P-1.1.2 — Integración documental: contrastar salida y evidencias de Fase 2, permisos y dependencias del modelo; comprobar la puerta de avance (CA-1.1.1, CA-1.1.2).
- [x] P-1.1.3 — E2E documental: recorrer las ocho vistas en un guion de navegación, incluyendo login, alta pendiente y destinos diferidos (CA-1.1.3).
- [x] P-1.1.4 — Seguridad/RLS: revisar la matriz de lectura/escritura para anónimo, A, B, moderador y admin; sin ejecutar servicios en este sprint documental (CA-1.1.2).

**Evidencia de cierre**

- Contratos y guion documental registrados a continuación; Sprint 1.1
  completado el 2026-10-15.

### Evidencia registrada del Sprint 1.1 — 2026-10-15

- Fase 2 completada con sus pruebas y confirmación manual explícita del
  usuario. Se elimina el bloqueo de usuarios, sin repetir su implementación.
- Aprobaciones del usuario en esta sesión: hashtags obligatorios y solo
  visuales, contrato Unicode 1–5/2–30, imágenes estáticas 5 MiB/4096,
  lectura pública con bucket privado y firmas, título/descripción/catálogo,
  mutación exclusivamente propia para todos los roles y rutas sin aliases.
- ERS, alcance, modelo, seguridad, estructura, especificación, acciones,
  UI, roadmap y backlog actualizados; nuevo identificador `VIA-037`.
  Las garantías técnicas de cursor, idempotencia, versión y limpieza
  quedan especificadas antes de diseñar el esquema.
- Guion documental de las ocho vistas: portada conserva accesos → login
  Clerk existente → sin perfil, completar primero → feed público →
  crear exige sesión/perfil → detalle público con hashtags no clicables →
  perfil/galería propias con edición y borrado autorizados. Búsqueda y
  navegación por hashtags quedan en Fase 5; administración en Fase 7.
  No se afirma que existan ni se hayan recorrido pantallas aún no creadas.
- Matriz documental contrastada: anónimo solo lee publicado; A muta A,
  B no muta A; moderador/admin no tienen excepción para contenido ajeno.
  La tabla privada de perfiles y cargas pendientes no se exponen por joins,
  RPC ni Storage. Las pruebas directas se implementarán en 1.2 y 2.1.
- Sprint exclusivamente documental: no se han aplicado migraciones,
  creado buckets de publicaciones ni desplegado. Sprint 1.2 queda pendiente.

### Sprint 1.2 — Esquema de publicaciones y RLS directa

**Objetivo:** demostrar en PostgreSQL que solo se admiten publicaciones válidas y operaciones autorizadas.

**Alcance**

- [x] Migración incremental de `posts` y catálogo mínimo aprobado, con restricciones e índices.
- [x] RLS, privilegios de columnas y proyecciones seguras para consultas.
- [x] Rollback/reaplicación sin pérdida de datos de usuarios.

**Tareas**

- [x] `VIA-004` Crear esquema según contrato aprobado: autor referenciado a `profiles`, categoría existente, título, descripción, referencia de imagen, estado y timestamps; no crear tablas sociales anticipadas.
- [x] `VIA-037` Persistir hashtags con restricciones de cantidad, longitud, caracteres, forma canónica y unicidad por publicación; validar Unicode y escrituras directas sin publicar metadata parcial.
- [x] `VIA-004` Versionar catálogo mínimo y restricciones de campos; preservar identidad, autor y timestamps no editables.
- [x] `VIA-004` Añadir índices para orden reciente, autor y categoría y probar paginación estable con fechas iguales.
- [x] `VIA-005` Resolver `profiles.id` desde el `sub` Clerk y aplicar la matriz aprobada de `SELECT`, `INSERT`, `UPDATE`, `DELETE`, incluidos `USING` y `WITH CHECK`.
- [x] `VIA-005` Limitar lectura pública al estado aprobado y evitar filtración de campos privados del autor; no usar `service_role` en consultas ordinarias.
- [ ] `VIA-004` Documentar rollback incremental, precondiciones y respaldo si hubiera datos; ensayar en base desechable y mantener intacto el catálogo de perfiles.

**Criterios de aceptación**

- [ ] CA-1.2.1 — Base limpia y actualización desde Fase 2 obtienen restricciones, catálogo e índices esperados; referencias inexistentes y datos inválidos se rechazan.
- [x] CA-1.2.2 — A solo escribe lo autorizado como A; B, anónimo, claims ausentes/malformados y roles no autorizados no pueden modificar filas ajenas ni reasignar autoría.
- [x] CA-1.2.3 — Lecturas públicas muestran solo contenido permitido y autor público, sin `clerk_user_id` ni datos privados.
- [x] CA-1.2.4 — Rollback y reaplicación preservan perfiles y reproducen el catálogo de la fase, sin fixtures residuales.

**Pruebas**

- [x] P-1.2.1 — Unitarias/SQL: límites, normalización, estados, FK inválidas e inmutabilidad; no duplicar lógica SQL en una utilidad ficticia (CA-1.2.1, CA-1.2.2).
- [ ] P-1.2.2 — Integración: migrar base limpia y base de Fase 2; consultar catálogo, seed y paginación con empates; revertir/reaplicar y comparar objetos (CA-1.2.1, CA-1.2.4).
- [x] P-1.2.3 — E2E: no aplica aún; no hay UI de publicaciones. El flujo se verificará en 2.2 y 3.1.
- [x] P-1.2.4 — Seguridad/RLS: matriz SQL directa de CRUD con A/B, anónimo, moderador/admin según contrato, `sub` inválido y cambios de propietario; comprobar REST/RPC y columnas públicas (CA-1.2.2, CA-1.2.3).

**Evidencia de cierre**

- Parcial: falta instalación totalmente limpia en Supabase aislado.

### Evidencia registrada del Sprint 1.2 — 2026-10-15

- Usuario autoriza migración incremental y fixtures en transacciones
  revertidas, sin bucket ni despliegue. Aplicada por MCP como
  `20261015162153_add_posts_contract`; versión local y rollback alineados.
  El intento de comprobación CLI `db push --dry-run` quedó esperando
  conexión y se detuvo; no se usó para modificar la base.
- `posts`/`categories` con RLS forzada, catálogo de cinco categorías,
  autor derivado de `sub`, grants de columnas y matriz exclusivamente
  propia para todos los roles. `text[]` unidimensional/base 1 con cantidad,
  longitud por puntos de código, minúsculas/NFC y duplicados validados
  en PostgreSQL 17 (`pg_c_utf8`), sin normalización silenciosa.
- Referencias restrictivas sin `CASCADE`; imagen exige ruta propia y
  objeto `storage.objects` existente con `owner_id` autenticado. No se
  habilitan cargas reales: bucket, validación de bytes y tickets/limpieza
  se incorporarán en 2.1 antes del formulario 2.2.
- Operación única por autor, versión incrementada por trigger y campos
  internos inmutables. Se prueban conflicto de operación, actualización
  con versión obsoleta y atomicidad de errores; devolver idempotentemente
  una operación repetida corresponde a la acción de Sprint 2.2.
- `get_public_posts` expone doce campos públicos exactos con máximo doce
  filas por página; feed/detalle/autor con cursor por fecha e ID.
  Prueba con 17 fechas iguales obtiene páginas de 12 y 5 sin duplicados.
  No expone identidad Clerk, ID privado de autor, operación ni versión.
- `test:db:posts` y `test:db:posts:rollback` superados. El preflight desde
  Fase 2 sin tablas de publicaciones también pasó sin persistir cambios.
  Ensayo de rollback/reaplicación compara columnas, restricciones, índices,
  funciones, grants, políticas, triggers y RLS; solo normaliza CRLF/LF
  de las definiciones. Verifica rechazo con posts o categorías personalizadas
  y preservación de filas/permisos de perfiles existentes.
- `test:db:posts:api` superado con clave publicable: categorías y RPC
  públicas disponibles, tablas privadas denegadas a anónimo/token alterado,
  cursor incompleto rechazado con HTTP 400/SQLSTATE 22023. Es solo lectura;
  la proyección no vacía se verifica en SQL con fixtures.
- Regresión: 164 pruebas Vitest, typecheck, lint y matrices previas de
  perfiles, jerarquía de roles, proyección pública y avatares superadas.
  No se repiten build/E2E de UI: el incremento es SQL y scripts, sin
  cambios adicionales de componentes o rutas en este sprint.
- Consulta final: cero posts, cinco categorías, cero perfiles fixture,
  cero objetos y buckets `posts`, cero tareas de limpieza. Los tests
  usan solo metadatos Storage transaccionales, no archivos físicos.
- **Pendiente real:** instalar toda la base desde cero y ensayar en un
  Supabase desechable/aislado. No se encontraron `docker` ni `psql` en PATH.
  El preflight en la base Fase 2 y su rollback transaccional no equivalen
  a esa comprobación. CA-1.2.1, P-1.2.2 y la tarea de ensayo desechable
  siguen abiertos; no se resetea el proyecto compartido ni se crea un
  proyecto/rama con coste sin autorización.
- Decisión posterior del usuario: usar la base existente, en el mismo
  esquema que `profiles`, sin crear otra base. Se confirma por MCP que
  `public.posts` y `public.categories` ya existen allí con RLS habilitada,
  catálogo de cinco categorías y cero publicaciones de prueba. El ensayo
  de instalación limpia queda diferido y no se ejecutará mediante un reset
  del remoto compartido. La validación incremental anterior sí está completa;
  los casilleros abiertos identifican solo ese ensayo adicional, no tablas
  pendientes de crear ni un fallo de la migración aplicada.

## Hito 2 — Imagen publicada y persistente

### Incremento de publicación mínima — 2026-10-15

Se atendió la petición del usuario de llegar a probar una publicación real
con lo mínimo del contrato aprobado, usando la misma base que `profiles`.

- Migración aplicada: [20261015164718_add_post_publishing.sql](../../supabase/migrations/20261015164718_add_post_publishing.sql);
  [rollback](../../supabase/rollbacks/20261015164718_add_post_publishing.sql)
  protegido frente a datos existentes. Bucket `posts` privado, WebP, 5 MiB.
- [Crear](../../app/crear/page.tsx) exige perfil propio y ofrece imagen,
  título, categoría y 1–5 hashtags; descripción opcional. Enlace desde el perfil.
  Selector con preview cancelable, foco en errores y bloqueo mientras publica.
- [Acción](../../actions/posts.ts) revalida sesión/perfil, normaliza entrada
  allowlist y bytes reales. Reutiliza el pipeline de avatar conservando su
  límite independiente de 2 MiB; límite multipart compartido de 6 MiB.
- Journal privado con lease de 10 minutos; begin/upload/commit, recuperación
  de respuesta perdida y limpieza explícita. Autor y ruta se derivan del JWT.
  Se revoca INSERT directo de posts y cambio directo de `image_path`.
- [Detalle público](../../app/post/[id]/page.tsx) por petición con firma de
  60 segundos, imagen sin optimizador Next, autor público y hashtags no navegables.
- SQL transaccional y ensayo de rollback/reaplicación pasaron en la base
  existente, sin conservar fixtures ni modificar perfiles reales.
- [E2E real](../../e2e/post-publishing.spec.ts): login, error de título,
  publicación de archivo exactamente 5 MiB, descripción vacía, recarga,
  confirmación repetida al mismo ID, visitante anónimo e imagen WebP firmada.
  Una carga pendiente no puede firmarse como anónimo. Detalle sin desbordamiento
  a 375, 768 y 1280 px. Cleanup de posts, objetos, tickets e identidades propios.
- Pruebas unitarias incluyen límites de bytes/codepoints, Unicode/NFC,
  WebP animado real, sesión/perfil, allowlist, respuesta perdida, fallos de
  limpieza y firma segura; no equivalen a inyectar todos esos fallos en remoto.
- Resultado de regresión: 211 unitarias en 19 archivos y 5 E2E Chromium
  aprobados; typecheck, lint, build y escaneo de secretos cliente aprobados.
  Frontera HTTP pública/privada aprobada; consulta posterior confirmó cero
  perfiles y tickets de fixtures de publicación. Servidor local comprobado
  con portada HTTP 200 y `/crear` anónimo HTTP 307 hacia autenticación.
- Confirmación manual del usuario el 2026-10-15: «ya cree». Confirma haber
  creado una publicación; no se aportaron ID, captura ni confirmación manual
  de recarga o lectura anónima. Estas últimas mantienen la evidencia E2E anterior.

Este incremento no cierra íntegramente 2.1/2.2/3.1: siguen pendientes los
casos ampliados del plan (arrastre/teclado completo, sesión expirada durante
publicación, fallos remotos inyectados y retirada física de bucket aislado).
En ese punto feed, galerías, edición y eliminación desde UI aún no estaban
implementados; el avance de lectura posterior se registra en Sprint 3.1.
Se mantiene diferido el ensayo de instalación limpia, sin
resetear la base compartida ni crear otro proyecto.

### Sprint 2.1 — Storage seguro y carga recuperable

**Objetivo:** subir una imagen válida a una ruta propia sin exposición prematura ni escritura ajena.

**Alcance**

- [x] Bucket `posts`, políticas y configuración de imagen versionados.
- [x] Carga validada en servidor y componente accesible reutilizable en `/crear`.
- [x] Recuperación de fallos y limpieza de cargas canceladas.

**Tareas**

- [x] `VIA-009` Reutilizar las utilidades de imagen/Storage de Fase 2 donde proceda, manteniendo límites específicos del contrato de publicaciones.
- [x] `VIA-009` Versionar bucket y políticas de lectura/escritura; usar ruta derivada de identidad y nombre no reutilizado, sin aceptar rutas del cliente.
- [x] `VIA-009` Validar bytes, tipo real, tamaño y dimensiones; rechazar SVG, contenido incompatible, archivo vacío y formato fuera del contrato.
- [x] `VIA-009` Implementar selector, previsualización, cancelación, estado pendiente y mensajes de error; el arrastre no será la única vía.
- [x] `VIA-009` Vincular cargas a una operación/propietario verificables y definir caducidad, compensación y recuperación de pendientes sin borrado global.
- [ ] `VIA-009` Ensayar rollback de configuración/políticas y limpieza de objetos de prueba en Storage aislado; no confiar solo en rollback SQL.

**Criterios de aceptación**

- [x] CA-2.1.1 — Imagen válida queda almacenada como propia; los límites aprobados se cumplen también en servidor y bucket.
- [ ] CA-2.1.2 — Archivo inválido, sesión ausente/expirada y ruta ajena no crean un objeto usable ni exponen datos internos.
- [x] CA-2.1.3 — A no puede leer cargas privadas, sobrescribir o eliminar objetos de B; lectura de objetos publicados respeta el contrato aprobado.
- [ ] CA-2.1.4 — Cancelación, reintento y fallo parcial tienen recuperación comprobada; rollback y cleanup dejan cero objetos de prueba residuales.
- [ ] CA-2.1.5 — El selector es utilizable con teclado, muestra errores anunciables y no desborda móvil, tablet o escritorio.

**Pruebas**

- [ ] P-2.1.1 — Unitarias: contenido/MIME discordante, formato, ruta, dimensiones y valores justo por debajo, igual y por encima de cada límite aprobado (CA-2.1.1, CA-2.1.2).
- [ ] P-2.1.2 — Integración: carga válida, cancelación, doble envío y errores de red/Storage; verificar compensación, rollback y cero residuos (CA-2.1.1, CA-2.1.4).
- [ ] P-2.1.3 — E2E: seleccionar por teclado y arrastre, visualizar preview, cancelar, corregir archivo inválido y reintentar; comprobar 360, 768 y 1280 px (CA-2.1.5).
- [ ] P-2.1.4 — Seguridad/RLS/Storage: acceso directo A/B/anónimo, token inválido, ruta manipulada, lectura de pendientes y sobrescritura; comprobar también URL de entrega, no solo API de listado (CA-2.1.2, CA-2.1.3).

**Evidencia de cierre**

- Implementación comprobada; publicación real, límites, validación y
  permisos cubiertos por la evidencia del incremento mínimo y la revisión
  de cierre. Permanecen abiertos el rollback físico aislado y los casos
  ampliados de fallos/selector que se detallan al final.

### Sprint 2.2 — Crear una publicación sin duplicados

**Objetivo:** completar `/crear` y obtener una publicación confirmada con imagen y metadata coherentes.

**Alcance**

- [x] Formulario del wireframe adaptado al contrato aprobado.
- [x] Acción `createPost` con validación, identidad, categoría e imagen propia.
- [x] Confirmación persistente y errores recuperables sin duplicados.

**Tareas**

- [x] `VIA-010` Crear validador compartido y acción de servidor; derivar autor de sesión/perfil y comprobar categoría y referencia de imagen propias.
- [x] `VIA-010` `VIA-037` Construir `/crear` con imagen, título, descripción, categoría y hashtags obligatorios; omitir comunidad hasta Fase 5.
- [x] `VIA-010` Revalidar sesión y perfil al enviar, gestionar doble envío y reintento idempotente, y devolver identificador confirmado.
- [x] `VIA-010` Ordenar upload/confirmación según contrato y compensar fallos; no publicar objetos pendientes por tener una URL.
- [x] `VIA-010` Mostrar confirmación mínima con ID real y revalidar las consultas afectadas; el enlace al detalle está incorporado en 3.1.
- [x] `Sin identificador existente` Registrar etapa y código de fallo sin tokens, contenido privado, rutas firmadas ni mensajes internos; no convertir un error de persistencia en éxito.

**Criterios de aceptación**

- [x] CA-2.2.1 — Usuario con perfil y datos válidos obtiene exactamente una fila propia y una imagen asociada; ambos persisten tras recarga.
- [x] CA-2.2.2 — Falta de imagen/título/categoría/hashtags, categoría inexistente, hashtag inválido o referencia de objeto ajeno se rechazan sin publicación parcial.
- [ ] CA-2.2.3 — Sesión ausente/expirada o perfil ausente impiden publicar, aunque se invoque directamente la acción.
- [ ] CA-2.2.4 — Doble envío, pérdida de respuesta y fallo de inserción/confirmación no duplican publicación ni esconden limpieza pendiente.
- [ ] CA-2.2.5 — Formulario tiene labels, foco, errores de campo y estado pendiente accesibles; funciona a 360, 768 y 1280 px.

**Pruebas**

- [x] P-2.2.1 — Unitarias: campos y límites exactos del contrato; normalización y clasificación segura de errores (CA-2.2.2, CA-2.2.4).
- [ ] P-2.2.2 — Integración: acción + PostgreSQL + Storage, flujo válido, categorías inválidas, doble envío, respuesta perdida y fallos parciales; inspeccionar filas y objetos (CA-2.2.1, CA-2.2.2, CA-2.2.4).
- [x] `VIA-037` Unitarias/integración: límites 1/5 etiquetas y 2/30 caracteres, rechazo 0/6 y 1/31, Unicode/NFC, mayúsculas, prefijo, duplicados, caracteres inválidos y atomicidad en errores de hashtags (CA-2.2.2).
- [ ] P-2.2.3 — E2E: login → `/crear` → corregir error → publicar → confirmación → recarga; comprobar teclado y responsive (CA-2.2.1, CA-2.2.5). `E2E-02` completo se cierra en 3.1.
- [ ] P-2.2.4 — Seguridad/RLS: invocar sin sesión/perfil, con sesión expirada, autor alterado y archivo B; comprobar rechazo directo en PostgreSQL/Storage (CA-2.2.2, CA-2.2.3).

**Evidencia de cierre**

- Flujo de creación aprobado en el E2E CRUD previo; unitarias, SQL y
  comprobación de envío interrumpido aprobadas. No se cierra la matriz
  completa de fallos remotos o sesión caducada durante el envío.

## Hito 3 — Vistas de lectura conectadas a datos reales

### Sprint 3.1 — Feed, detalle y galerías propias

**Rediseño solicitado y confirmado visualmente por el usuario el 2026-10-15:**
feed en columna única con autor, imagen grande, título, descripción y
hashtags; carga de lotes sucesivos al bajar sin cambiar de página, con
botón accesible alternativo y reintento explícito. Las galerías propias
y públicas usan tres columnas de imágenes cuadradas sin título,
descripción ni datos de autor visibles en cada tile; el nombre accesible
y el enlace al detalle se conservan. Se renueva una vez una imagen cuya
firma haya fallado durante un scroll prolongado. El usuario indicó
«se ven bien» sobre el diseño compartido; no equivale a validar el CRUD.

**Avance 2026-10-15:** implementados `/inicio` público, `/imagenes` privado
y publicaciones por autor en el perfil público. Tarjetas compartidas con
imagen firmada, título, autor, categoría y hashtags; enlaces desde portada,
perfil y detalle. Galería propia deriva el filtro del perfil autenticado,
con conteo exacto bajo RLS. Cursores fecha/UUID, páginas de 12 sin convertir
los timestamps a `Date`; entrada malformada, vacío y servicio fallido
se distinguen. El detalle conserva la validación previa de entrega.

E2E enfocado aprobado con un usuario Development efímero: galería vacía,
crear desde perfil, galería con 1 publicación, feed anónimo → detalle →
perfil público, 13 publicaciones propias → páginas 12/1 sin duplicar el
post inicial, total exacto, regreso a recientes y rechazo de galería
anónima. No desborda a 360/768/1280 px. Limpieza de fixtures al terminar.
No se aplicaron nuevas migraciones ni se modificaron posts del usuario.
Los casilleros pendientes conservan los casos ampliados aún no cerrados,
incluida revisión accesible integral. La galería se abre desde «Mi galería»
en `/perfil`: no se añadirá una segunda galería embebida que altere el diseño
aprobado.

**Objetivo:** comprobar las pantallas 3, 5 y 7 con datos persistentes, imagen y autor público correctos.

**Alcance**

- [x] `/inicio`, `/post/[id]`, `/imagenes` y acceso a publicaciones desde `/perfil`, conforme al diseño aprobado.
- [x] Tarjetas reutilizables, listado paginado y conteos reales.
- [x] Estados de carga, vacío, inexistente/no visible y servicio no disponible.

**Tareas**

- [x] `VIA-011` Centralizar consultas tipadas fuera de componentes visuales y reutilizar la proyección pública de perfiles.
- [x] `VIA-011` Implementar feed reciente con cursor estable y galerías filtradas por propietario; no descargar todo para filtrar en el navegador.
- [x] `VIA-012` Implementar detalle y acceso a imagen original con el mismo permiso; validar ID y distinguir error de servicio de inexistencia.
- [x] `VIA-011` Enlazar desde el perfil propio a `/imagenes`, con galería y conteo real allí; mantener edición de perfil separada de edición de post.
- [x] `VIA-011` `VIA-012` `VIA-037` Mostrar imagen, título, autor, descripción, categoría y hashtags como texto en feed/detalle; galerías solo con imágenes y nombres accesibles. Mantener buscador, navegación por hashtag e interacciones diferidos sin botones engañosos.
- [ ] `Sin identificador existente` Conectar portada/acceso, feed, crear y volver; conservar retorno tras login. Dejar acciones editar/eliminar para sus sprints, sin enlaces rotos.
- [ ] `Sin identificador existente` Optimizar imágenes con dimensiones estables, alternativa textual y origen permitido; asegurar contraste, foco y responsive.

**Criterios de aceptación**

- [x] CA-3.1.1 — Publicación confirmada aparece en feed, detalle y galería de A, con autor público correcto y conteo persistente; no aparece como propia en B.
- [x] CA-3.1.2 — Paginación no repite ni omite filas en un dataset estable con timestamps iguales; vacío, ID inválido y publicación inexistente/no visible tienen respuesta controlada.
- [x] CA-3.1.3 — Fallo de datos o de entrega de imagen se presenta como error recuperable, no como feed vacío exitoso; no se filtran campos privados.
- [x] CA-3.1.4 — Las vistas respetan el contrato público/privado y el original no evade permisos; navigation/login/logout no regresan.
- [ ] CA-3.1.5 — Tarjetas, detalle y galerías no desbordan a 360, 768 y 1280 px, son utilizables con teclado y muestran imágenes sin saltos de layout evitables.

**Pruebas**

- [x] P-3.1.1 — Unitarias: proyecciones públicas, cursor, ID y transformación de estados incluyendo imagen no disponible (CA-3.1.2, CA-3.1.3).
- [ ] P-3.1.2 — Integración: publicaciones A/B, consultas propias, públicas, orden con empates, varias páginas y error de Supabase/Storage (CA-3.1.1 a CA-3.1.4).
- [x] P-3.1.3 — E2E: completar `E2E-02`, ir de feed a detalle y volver, visitar perfil/galería, recargar y repetir con B/anónimo según contrato; comprobar acceso y logout (CA-3.1.1, CA-3.1.4).
- [ ] P-3.1.4 — Seguridad/RLS/Storage: consultas directas, payloads y URLs del original no exponen publicaciones privadas, cargas pendientes o datos internos del autor (CA-3.1.3, CA-3.1.4).
- [ ] P-3.1.5 — Accesibilidad/responsive: teclado, jerarquía, textos alternativos, foco, contraste y capturas en los tres anchos definidos (CA-3.1.5).

**Evidencia de cierre**

- Diseño confirmado por el usuario; lectura pública, galería propia,
  paginación, aislamiento B, logout y anchos comprobados. Consultas/cursor
  y estados de error tienen cobertura unitaria. Accesibilidad ampliada y
  fallos de entrega en navegador siguen abiertos; véase revisión de cierre.

## Hito 4 — Publicaciones propias administrables

### Sprint 4.1 — Editar datos e imagen sin perder el original

**Implementación 2026-10-15:** ruta `/post/[id]/editar` con guarda de perfil y
lectura propia bajo RLS. Se reutiliza el formulario y contrato de creación:
conservar imagen es el comportamiento por defecto y reemplazarla es opcional.
No se resetean los campos después de errores. La mutación de metadata usa
ID + versión; la sustitución usa la RPC de
[20261015192000_add_post_image_replacement.sql](../../supabase/migrations/20261015192000_add_post_image_replacement.sql).
La RPC bloquea post propio y ticket propio, verifica lease/objeto/versión,
confirma metadata e imagen y agenda la anterior en una transacción.
La repetición de una operación confirmada devuelve el mismo ID. Se conserva
el original si hay fallo o conflicto y se informa si falla la limpieza.

El preflight SQL, la aplicación incremental y el ensayo de rollback/
reaplicación se ejecutaron en el proyecto existente. MCP solicitó
reautenticación; se usó la CLI Management ya autenticada, registrando
migración y DDL en la misma transacción, sin reset ni otro proyecto.

**Objetivo:** editar una publicación propia y actualizar todas sus vistas sin modificar recursos ajenos.

**Alcance**

- [x] Formulario de edición y acción `updatePost`.
- [x] Reemplazo opcional de imagen con compensación.
- [x] Acceso desde las imágenes de la galería al detalle, donde se ofrecen los controles propios; sin controles visibles adicionales en el grid aprobado.

**Tareas**

- [x] `VIA-013` Cargar datos autorizados y reutilizar formulario/validadores de creación; conservar autor, ID y campos internos.
- [x] `VIA-037` Editar hashtags propios con el mismo contrato y persistencia atómica; comprobar sustitución, duplicados, rechazo de lista vacía, escritura ajena y recarga en feed/detalle.
- [x] `VIA-013` Comprobar sesión y propiedad en servidor y en la mutación RLS; no confiar en controles ocultos.
- [x] `VIA-013` Definir control de concurrencia conforme al contrato y avisar de edición obsoleta en lugar de perder cambios silenciosamente.
- [x] `VIA-013` Cargar imagen nueva, confirmar referencia y retirar la anterior en el orden aprobado; mantener original ante fallo y registrar cleanup pendiente si procede.
- [x] `VIA-013` Revalidar feed, detalle, galería y perfil; preservar accesibilidad y mensajes recuperables.

**Criterios de aceptación**

- [x] CA-4.1.1 — A edita campos válidos y opcionalmente la imagen; todos los listados y el detalle muestran el resultado persistente.
- [x] CA-4.1.2 — Datos inválidos, categoría inexistente y edición obsoleta no sobrescriben la versión válida y muestran error comprensible.
- [x] CA-4.1.3 — B, anónimo y roles sin permiso aprobado no editan A ni reasignan autor/imagen; URL y acción directa también rechazan el intento.
- [ ] CA-4.1.4 — Fallo de Storage/base o pérdida de sesión conservan una publicación recuperable sin pérdida del original ni residuos no registrados.
- [ ] CA-4.1.5 — Edición funciona con teclado y en los tres anchos definidos, incluidos estado pendiente y foco de error.

**Pruebas**

- [x] P-4.1.1 — Unitarias: campos editables, límites, versión obsoleta y errores; autor e ID quedan fuera de entrada editable (CA-4.1.2, CA-4.1.3).
- [ ] P-4.1.2 — Integración: editar con/sin imagen, dos ediciones concurrentes, fallo de carga/confirmación/limpieza y sesión expirada; comprobar referencias y objetos (CA-4.1.1, CA-4.1.2, CA-4.1.4).
- [ ] P-4.1.3 — E2E: `E2E-05` y `E2E-06`, recarga y verificación en feed/perfil; teclado y responsive (CA-4.1.1, CA-4.1.3, CA-4.1.5).
- [ ] P-4.1.4 — Seguridad/RLS/Storage: actualizar fila A como B, cambiar autor, vincular objeto ajeno y reemplazar directamente archivo ajeno (CA-4.1.3).

**Evidencia de cierre**

- Edición y reemplazo aprobados en el E2E CRUD previo; SQL y unitarias
  cubren versión y permisos. El E2E ampliado comprueba recarga con título
  actualizado en detalle, feed, galería y perfil público, hashtags
  persistentes y conservación de imagen al editar metadata. Fallos remotos
  durante la operación y accesibilidad ampliada permanecen abiertos.

### Sprint 4.2 — Eliminar con confirmación y limpieza verificable

**Implementación 2026-10-15:** controles únicamente en detalle propio,
diálogo nativo con foco inicial en cancelar, cancelación sin mutación y
confirmación explícita. Acción autenticada con perfil/propiedad y versión;
la retirada activa el journal ya existente y después intenta limpiar Storage.
Se distingue post retirado de limpieza pendiente y hay recuperación desde
la galería. No se acepta una ruta de imagen del navegador. Reintentar un
ID ya ausente es seguro; una versión cambiada impide borrar.

SQL transaccional aprobado: A/B/anónimo, objeto faltante, lease nulo,
versión obsoleta, sustitución atómica, repetición, metadata sin imagen,
eliminación propia y estados de limpieza. Unitarias enfocadas cubren
66 casos de las superficies afectadas, incluidos fallos de servicio y
cleanup; typecheck, lint, build y escaneo de secretos cliente aprobados.
Los casos manuales ampliados del plan se mantienen abiertos.

**E2E final aprobado (2 minutos):** publicación real de 5 MiB, galería
solo-imágenes con páginas de 12/1, feed vertical y carga de lotes al bajar,
edición de texto/hashtags conservando imagen, reemplazo a una imagen de
48 píxeles con nueva versión y limpieza del journal anterior, controles
ausentes para visitante, edición anónima redirigida, cancelar sin borrar
y devolver foco, confirmar eliminación y volver a galería con total 12,
fila y journal retirados y detalle anterior no disponible. La navegación
tras borrar se realiza con redirect de servidor antes de renderizar el 404.
Consulta posterior: cero perfiles de fixtures de posts; migración de
reemplazo registrada; feed local HTTP 200. No se ejecutó la regresión E2E
completa de perfiles/avatares en este incremento.

**Objetivo:** retirar una publicación propia y recuperar fallos de borrado sin éxito ficticio.

**Alcance**

- [x] Confirmación accesible y acción `deletePost` idempotente.
- [x] Retirada de listados, detalle y conteo propio.
- [x] Limpieza de imagen y recuperación ante errores parciales.

**Tareas**

- [x] `VIA-014` Incorporar confirmación explícita, cancelar sin cambios y prevenir doble envío.
- [x] `VIA-014` Comprobar sesión, propiedad y referencia almacenada; nunca borrar una ruta aportada por el cliente.
- [x] `VIA-014` Ejecutar el protocolo aprobado de retirada y limpieza; diferenciar contenido retirado, limpieza pendiente y eliminación terminada.
- [x] `VIA-014` Hacer reintentos seguros, preservar contexto de recuperación y registrar fallos sin secretos.
- [x] `VIA-014` Revalidar feed, detalle, galería y conteo; verificar caducidad o invalidación de entrega de imagen según contrato, sin prometer borrar copias descargadas.

**Criterios de aceptación**

- [x] CA-4.2.1 — Confirmar retira la publicación de las vistas y limpia su objeto; cancelar conserva fila e imagen.
- [x] CA-4.2.2 — B, anónimo y roles no autorizados no eliminan fila ni objeto de A, aun manipulando ID/ruta.
- [ ] CA-4.2.3 — Repetir la operación no afecta otras publicaciones; errores parciales se notifican y pueden resolverse hasta cero residuos.
- [x] CA-4.2.4 — Detalle retirado, conteos y URL de imagen cumplen el contrato después del borrado y su ventana de caducidad definida.
- [ ] CA-4.2.5 — Confirmación anuncia alcance y errores, gestiona foco y funciona con teclado y responsive.

**Pruebas**

- [x] P-4.2.1 — Unitarias: estados de borrado/reintento, clasificación de fallos y selección de referencia almacenada (CA-4.2.2, CA-4.2.3).
- [ ] P-4.2.2 — Integración: confirmar/cancelar, doble intento, fallo de base/Storage/limpieza; inspeccionar filas, referencias, cero residuos finales y caducidad de acceso (CA-4.2.1, CA-4.2.3, CA-4.2.4).
- [ ] P-4.2.3 — E2E: A elimina desde galería, vuelve a feed, visita detalle anterior y verifica conteo; cancelar y navegar por teclado en tres anchos (CA-4.2.1, CA-4.2.4, CA-4.2.5).
- [ ] P-4.2.4 — Seguridad/RLS/Storage: borrar A como B/anónimo, manipular ruta e intentar reutilizar URL retirada según contrato (CA-4.2.2, CA-4.2.4).

**Evidencia de cierre**

- Borrado/cancelación y limpieza propia aprobados en el CRUD previo;
  teclado del diálogo y vencimiento de firma antes de limpiar el objeto
  aprobados en el E2E ampliado. No se presenta esto como la matriz completa
  de fallos parciales reales ni como revisión accesible integral.

## Hito 5 — CRUD demostrado y fase cerrable

### Sprint 5.1 — Regresión integral y evidencia de salida

**Objetivo:** demostrar el CRUD completo, su equivalencia de permisos y la conservación de usuarios/autenticación.

**Alcance**

- [ ] Recorrido A/B y anónimo con creación, lectura, edición y eliminación.
- [ ] Regresión de Fases 1 y 2, migraciones, RLS y Storage.
- [ ] Evidencia reproducible y documentación actualizada.

**Tareas**

- [ ] `Sin identificador existente` Ejecutar comprobaciones locales existentes de tipos, lint, build y secretos; suites de perfil/publicaciones y E2E relevantes.
- [ ] `Sin identificador existente` Ampliar pruebas directas de base/Storage para publicaciones sin sustituir las pruebas de perfiles existentes ni usar fixtures reales.
- [ ] `Sin identificador existente` Validar historial de migraciones y rollback/reaplicación en entorno aislado, con limpieza separada de objetos.
- [ ] `Sin identificador existente` Recorrer portada → acceso → perfil completo → crear → feed → detalle → editar → eliminar → logout con A/B y permisos directos.
- [x] `Sin identificador existente` Verificar versiones de las guías locales de Next.js antes de implementar APIs/rutas y documentar solo decisiones realmente aprobadas.
- [ ] `Sin identificador existente` Registrar comandos, entorno autorizado, resultados, capturas sin datos sensibles, recuperación de fallos y ausencia de fixtures. Despliegue solo si se autoriza explícitamente.

**Criterios de aceptación**

- [ ] CA-5.1.1 — CRUD completo demostrado con filas/objetos persistentes y equivalencia de permisos en UI, acciones, PostgreSQL y Storage.
- [ ] CA-5.1.2 — Perfiles, avatar, roles, acceso y logout conservan los comportamientos de Fases 1 y 2; tipos, lint, build, pruebas y secretos pasan.
- [ ] CA-5.1.3 — Migraciones reproducibles, rollback probado y cleanup final sin usuarios, filas ni objetos de prueba residuales.
- [ ] CA-5.1.4 — Las vistas cubiertas tienen evidencia responsive/accesible; las diferidas están documentadas sin aparentar estar terminadas.
- [x] CA-5.1.5 — La salida del roadmap está respaldada por evidencia fechada y decisiones actualizadas, no solo por casillas.

**Pruebas**

- [x] P-5.1.1 — Unitarias: ejecutar suites relacionadas de perfiles, validadores de imagen/publicación y estados de error (CA-5.1.2).
- [ ] P-5.1.2 — Integración: regresión de acciones, auth-boundary, RLS de perfiles y publicaciones, Storage, migraciones y rollback; comprobar cero fixtures (CA-5.1.1 a CA-5.1.3).
- [ ] P-5.1.3 — E2E: recorrido CRUD completo A/B, `E2E-01`, `E2E-02`, `E2E-05`, `E2E-06`, acceso directo anónimo y sesiones expiradas; accesibilidad y tres anchos (CA-5.1.1, CA-5.1.2, CA-5.1.4).
- [ ] P-5.1.4 — Seguridad/RLS/Storage: repetir matriz aprobada, inspeccionar entrega de originales, payloads, logs y bundle; sin acceso ordinario con credenciales administrativas (CA-5.1.1, CA-5.1.2).
- [x] P-5.1.5 — Verificación documental: contrastar cobertura del roadmap, backlog, ocho vistas, CA→P y decisiones aprobadas con evidencia de cada sprint (CA-5.1.4, CA-5.1.5).

**Evidencia de cierre**

- Revisión fechada y comandos/resultados registrados a continuación.
  La salida funcional está demostrada; el usuario autorizó posteriormente
  el cierre con diferimiento explícito de las comprobaciones ampliadas.

## Validación final de la fase

- [ ] Todos los criterios de aceptación están verificados.
- [ ] Pruebas unitarias, integración y E2E requeridas superadas.
- [ ] Permisos de aplicación, RLS y Storage verificados cuando aplican.
- [ ] Migraciones y procedimiento de rollback validados cuando aplican.
- [ ] Accesibilidad y responsive comprobados cuando existe UI.
- [x] Documentación base actualizada si cambió una decisión.
- [x] Criterio de salida del roadmap demostrado.
- [x] Fase 2 cerrada con evidencia antes de iniciar implementación de publicaciones.
- [x] Todos los puntos de Fase 3 del roadmap tienen sprint; cada CA tiene pruebas asociadas.
- [x] Ningún elemento diferido de Proyecto se declara implementado ni se muestra como funcional.
- [x] Pruebas finales dejan cero fixtures en Clerk, PostgreSQL y Storage.

## Revisión de cierre — 2026-10-15

### Resultado y límites

El **CRUD del roadmap está implementado y demostrado**, con el diseño
aprobado conservado. No se encontraron funcionalidades del CRUD que deban
rehacerse. La revisión técnica no verificó todos los casos ampliados; el
usuario decidió posteriormente cerrar la fase y avanzar. Las comprobaciones
no realizadas quedan diferidas, no aprobadas. Una casilla abierta en una
prueba compuesta no significa que todo su flujo esté ausente.

No se creó otro proyecto/base, no se reseteó Supabase, no se cambiaron
migraciones ni datos del usuario. Se utilizó el proyecto existente junto a
`profiles`, con fixtures de desarrollo eliminados al finalizar. No se hizo
commit ni despliegue. La aprobación visual del usuario cubre crear, feed
continuo, galerías solo-imágenes, detalle, edición/reemplazo y borrado propio;
no se interpreta como una revisión manual de accesibilidad.

### Evidencia ejecutada en esta revisión

| Comando o comprobación | Resultado y alcance exacto |
| --- | --- |
| `npm test -- actions\posts.test.ts actions\post-management.test.ts actions\profiles.test.ts actions\avatars.test.ts lib\posts components\posts\post-layout.test.tsx components\profile\profile-pages.test.tsx` | 116 pruebas en 12 archivos aprobadas. Contratos, acciones, imágenes, concurrencia, recuperación simulada, cursor, repositorio y presentación; regresión unitaria relacionada de perfiles y avatar. |
| `npm run test:db:auth-boundary` | Aprobada la frontera de identidad con el proyecto existente. |
| `npm run test:db:posts` | Aprobados leases, idempotencia, restricciones, catálogo, proyección pública y matriz de roles/Storage con metadatos transaccionales; no equivale a fallos de red reales. |
| `npm run test:db:posts:management` | Aprobados reemplazo, conflictos de versión, propiedad, edición, borrado/journal y rollback/reaplicación de la RPC de reemplazo en transacciones revertidas. |
| `npm run test:db:posts:api` | Aprobadas frontera HTTP privada, catálogo, RPC pública y validación de cursor. |
| `node node_modules\supabase\dist\supabase.js migration list --linked` | Las ocho versiones locales coinciden con el historial remoto, incluida `20261015192000`. No se aplicaron migraciones. |
| `npx playwright test post-closure.spec.ts --project=chromium`, incluido en la selección posterior | Aprobado en Chromium. Dos identidades efímeras: B lee el detalle público, no ve controles propios ni formulario de edición y su galería cuenta cero; SQL/Storage reales rechazan mutación y sobrescritura ajenas. Se comprueba que una eliminación ajena de Storage no retira objetos aunque la API devuelva una lista vacía sin error. |
| Mismo [E2E ampliado](../../e2e/post-closure.spec.ts) | Crear, editar, detalle, galería y feed sin desbordamiento a 360/768/1280; diálogo con teclado, foco inicial en cancelar, Tab y restauración de foco. Selector con foco, preview, retirada y archivo ilegible corregible. Selección automatizada de archivo: no prueba el diálogo nativo del SO ni arrastre. |
| Última ejecución enfocada del E2E ampliado | Una aprobada en 1,8 minutos, incluida edición real de título/hashtags, recarga en detalle/feed/galería/perfil público y comprobación de la referencia original de imagen. El grid continúa sin headings visibles. No se repitió el CRUD completo. |
| Mismo E2E ampliado | Interrupción del POST antes de llegar al servidor muestra error, conserva borrador y no crea otra fila. Tras retirar el post no se emiten nuevas firmas; la firma previa deja de servir después de su vencimiento, manteniendo el objeto hasta comprobarlo. Limpieza desde galería termina con cero tickets/objetos propios. No simula pérdida de respuesta después del commit ni una caída remota de Storage. |
| `npx playwright test post-closure.spec.ts avatar.spec.ts profile-onboarding.spec.ts --project=chromium` | Cuatro aprobadas y un fallo: avatar informó error de subida en Storage. No fue un falso éxito ni se ocultó el resultado. Perfiles, navegación, proyección pública y la comprobación ampliada de posts pasaron. |
| `npx playwright test avatar.spec.ts profile-onboarding.spec.ts --project=chromium --grep "real Storage ownership\|expired session"` | Dos aprobadas en la repetición enfocada: avatar completo (subida, reemplazo, retirada y limpieza) y JWT vencido rechazado en las tres rutas privadas de perfil, `/crear`, `/imagenes` y edición de post. No se atribuye el fallo anterior a una causa confirmada. |
| `npm run typecheck` y `npx eslint e2e\post-closure.spec.ts e2e\profile-onboarding.spec.ts` | Aprobados. No cambió código de aplicación; no se repitieron build, lint global ni escaneo de secretos, ya aprobados en el incremento anterior. Esa evidencia previa se conserva separada de esta ejecución. |
| Limpieza final | Cero usuarios Clerk para los prefijos de fixtures ejecutados; cero perfiles `via_e2e_*`, `via_manage_*` y `via_publish_*`; cero tickets de posts/tareas de avatar huérfanos. Los tests comprueban los objetos físicos de sus carpetas. Se conserva una publicación existente y las cinco categorías. |
| Procesos locales | Servidor abierto solo para las pruebas y detenido al terminar; comprobado que no queda listener en el puerto 3000. |

La primera ejecución ampliada falló en un selector de prueba ambiguo
(`role=status` también identifica el conteo de galería). Se restringió al
formulario de limpieza y la prueba pasó. Al ampliar la propagación se detectó
que la espera predeterminada de 5 segundos vencía mientras la acción seguía
pendiente; se utilizó la misma espera de 30 segundos del CRUD existente y
pasó la comprobación completa, sin ignorar errores ni modificar la aplicación.
El runner del editor no descubrió Vitest; se usó el comando
existente de npm. Playwright se selecciona por nombre de archivo, no con
backslashes interpretados como una expresión regular.

La consulta de logs por Supabase MCP quedó bloqueada por autenticación
pendiente. La CLI enlazada sí permitió las comprobaciones descritas. No se
solicitó ni reveló ningún secreto y no se infiere una causa remota a partir
del nombre genérico `StorageApiError`.

### Pendientes reales, no nueva implementación del CRUD

| Pendiente | Casillas relacionadas | Evidencia que falta |
| --- | --- | --- |
| Fallos durante mutaciones reales | CA-2.1.2/4, CA-2.2.3/4, CA-4.1.4, CA-4.2.3; P-2.1.2, P-2.2.2/4, P-4.1.2, P-4.2.2 | Caducar/revocar sesión con formulario abierto y enviar; fallos de carga, confirmación y limpieza en la integración real; respuesta perdida después del commit. Unitarias, SQL y el POST abortado cubren partes, no toda esta matriz. |
| Límites ampliados de imagen | P-2.1.1 | Están probados 5 MiB/byte siguiente, 4096/píxel siguiente, imágenes menores, formatos reales y rechazos. No se ejecutaron todos los vecinos inmediatos de cada límite que exige literalmente esta prueba compuesta; no se marca íntegramente aprobada. |
| Accesibilidad ampliada | CA-2.1.5, CA-2.2.5, CA-3.1.5, CA-4.1.5, CA-4.2.5; P-2.1.3, P-3.1.5 y partes de P-4.1.3/P-4.2.3 | Se comprobaron anchos, foco y teclado indicados arriba, pero no contraste calculado de todas las vistas de posts, lector de pantalla, todos los estados pendientes/error ni arrastre. La selección nativa funciona; no se añadirá un dropzone para alterar el diseño aprobado. |
| Matrices compuestas del cierre | CA-5.1.1 a CA-5.1.4; P-3.1.2/4, P-5.1.2/3/4 | Consolidar los casos faltantes anteriores, fallo de entrega de imagen en navegador y la comprobación ampliada de payloads/logs. No repetir todo el CRUD ni todas las regresiones para cada caso. |
| Instalación desde cero y retirada física de bucket aislado | Tarea final de 1.2 y 2.1, CA-1.2.1, P-1.2.2 y parte de CA-2.1.4 | **Diferidos por la decisión de usar la base existente**, no por tablas faltantes. No se ejecutarán mediante reset del remoto, otra base ni retirada del bucket real. El ensayo incremental y los rollbacks transaccionales previos no equivalen a esto. |

No hay un despliegue nuevo confirmado. Desplegar no se considera un requisito
implícitamente autorizado para completar estas pruebas locales; cualquier
smoke desplegado posterior debe registrarse por separado.

### Puerta de Fase 4

El 2026-10-15, después de conocer los pendientes, el usuario indicó:
«cerramos fase 3 escribe la 4 dejando lista para comenzar en otra sesion
que diga comenzar fase 4». Se registra el cierre de producto y el
diferimiento de las comprobaciones ampliadas de la tabla anterior.
Esta decisión habilita planificar/iniciar Fase 4, pero no demuestra
pruebas no ejecutadas ni autoriza cambios remotos, commits o despliegues.
No quedan pendientes de rediseño de crear/feed/galerías.

Las casillas técnicas abiertas se conservan como deuda de verificación.
No se reabre automáticamente el CRUD al comenzar Fase 4; si un incremento
toca una superficie con deuda, se ejecuta la comprobación enfocada pertinente
y se registra su resultado. Instalación limpia y retirada aislada de bucket
no se intentarán en la base compartida.

La siguiente fase del roadmap es **interacción**: likes, comentarios,
compartir y seguimiento. Corresponde empezar por sus contratos y matriz de
permisos, y un primer incremento de likes idempotentes por usuario y post
con contador real, RLS y pruebas A/B/anónimo. Se reutilizan `profiles`, `posts`
y la base existente; no se activan controles sociales ficticios. Comunidades,
búsqueda y navegación por hashtag siguen en Fase 5. No se implementó Fase 4
en esta revisión.

El plan ejecutable siguiente es [Fase 4: Interacción](fase04.md).
La frase **«comenzar fase 4»** inicia su Sprint 1.1 y no una nueva
implementación de publicaciones.

## Registro de progreso

| Fecha | Sprint | Estado | Evidencia | Notas |
| --- | --- | --- | --- | --- |
| 2026-10-14 | 1.1 | Pendiente | — | Primer control de esta fase; cierre de Fase 2 y aprobación de contratos requeridos. No iniciado. |
| 2026-10-14 | 1.2 | Pendiente | — | Depende de 1.1 cerrado y Fase 2 completada; esquema y RLS antes de Storage. |
| 2026-10-14 | 2.1 | Pendiente | — | Depende de 1.2; validar objetos y rollback en Storage aislado. |
| 2026-10-14 | 2.2 | Pendiente | — | Depende de 2.1; publicación confirmada antes de construir lectura completa. |
| 2026-10-14 | 3.1 | Pendiente | — | Depende de 2.2; feed, detalle y galerías con datos reales. |
| 2026-10-14 | 4.1 | Pendiente | — | Depende de 3.1; edición y sustitución segura de imagen. |
| 2026-10-14 | 4.2 | Pendiente | — | Depende de 4.1; borrado y recuperación de fallos parciales. |
| 2026-10-14 | 5.1 | Pendiente | — | Depende de todos los anteriores; cierre integral, no implementación automática. |
| 2026-10-15 | 1.1 | Completado | Contratos y cierre de Fase 2 documentados | Entrada histórica del 14 conservada; ya no bloquea. |
| 2026-10-15 | 1.2 | Incremental validado; ensayo limpio diferido | SQL, API e historial local/remoto coincidente | Sin otra base ni reset; no se marca instalación limpia aprobada. |
| 2026-10-15 | 2.1 / 2.2 | Implementados; validación ampliada parcial | CRUD previo, 116 unitarias enfocadas, SQL y E2E ampliado | Selector nativo y recuperación implementados; faltan casos integrales indicados arriba. |
| 2026-10-15 | 3.1 | Implementado y diseño aprobado | Feed continuo, galerías, lectura A/B/anónimo, cursor y anchos | Sin galería duplicada en perfil; pendiente accesibilidad ampliada/fallo de imagen en navegador. |
| 2026-10-15 | 4.1 / 4.2 | CRUD propio validado; casos ampliados abiertos | Edición/reemplazo, propagación, borrado, permisos y firma vencida | Conservar diseño; fallos remotos y revisión accesible no se dan por probados. |
| 2026-10-15 | 5.1 | Cierre integral todavía no declarado | Revisión de cierre, limpieza y regresión enfocada registradas | Sin commit ni despliegue nuevo; Fase 4 solo definida como siguiente paso. |
| 2026-10-15 | Cierre de fase | Cerrada por decisión del usuario | Petición expresa posterior a la revisión de cierre | CRUD aceptado; pruebas ampliadas diferidas con casillas abiertas; Fase 4 habilitada sin autorización de operaciones remotas. |
