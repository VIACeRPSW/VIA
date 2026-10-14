# VIA — Fase 03: Publicaciones

## Estado

- Estado: Planificada
- Roadmap: Fase 3
- Dependencias: cierre verificable de Fase 2; perfiles propios y proyección pública segura; autenticación Clerk → Supabase bajo RLS; Supabase PostgreSQL y Storage disponibles; aprobación de los contratos y diferencias con los wireframes en el Sprint 1.1.
- Criterio de salida: CRUD completo de publicaciones con imagen persistente, listado, detalle, edición y eliminación propias, permisos equivalentes en aplicación, PostgreSQL y Storage, y vistas responsive comprobadas.
- Restricción: este documento solo planifica. No autoriza implementar, aplicar migraciones, modificar servicios remotos ni desplegar.

## Objetivo

Construir el flujo de publicaciones de VIA tomando como referencia visual [Proyecto](../Proyecto.md) y respetando la Fase 3 del [roadmap](../inicio/12-roadmap.md). Una persona con perfil podrá subir una imagen educativa, publicar sus datos, verla en el feed, abrir su detalle y administrar sus publicaciones desde el perfil y la galería propia.

La comprobación seguirá el orden identidad y perfiles → contratos → esquema y RLS → Storage → creación → lectura y vistas → edición → eliminación → regresión integral. Ningún sprint se cerrará solo por una captura o por un caso exitoso de interfaz.

### Punto de partida comprobado el 2026-10-14

| Fuente | Situación documentada y observada | Consecuencia |
| --- | --- | --- |
| [Fase 1](fase01.md) | Completada; evidencia registrada de autenticación, conexión, RLS, rollback y despliegue autorizado. | Reutilizar la base existente; no repetir su implementación. La evidencia histórica no demuestra disponibilidad actual del remoto. |
| [Fase 2](fase02.md) | En curso. Sprints 1.1 y 1.2 completados; 2.1 implementado y en validación manual el 2026-10-14; 2.2 y 3.1 pendientes. | Completar la revisión de edición y continuar con avatar en Fase 2; no iniciar el CRUD. |
| [Perfil actual](../../app/perfil/page.tsx) | Presenta datos persistentes, perfil público y acceso a edición propia; deriva al alta cuando falta perfil. No incluye todavía subida de avatar ni galería. | Cerrar primero el sistema de usuarios; añadir publicaciones aquí solo en Fase 3. |
| [Migraciones](../../supabase/migrations/) | Cuatro migraciones de perfiles: creación, contrato, jerarquía de roles y consulta pública limitada. No hay esquema de publicaciones ni buckets versionados. | No dar por existentes `posts`, `categories`, `communities` o Storage de publicaciones. |
| [Cliente servidor](../../lib/supabase/server.ts) | Usa clave publicable y token Clerk con template `supabase`, sin credenciales administrativas para operaciones ordinarias. | Mantener este límite de privilegios y comprobar la frontera de identidad antes de añadir operaciones. |

La revisión inicial fue local y documental. La actualización de estado de Fase 2 del 2026-10-14 incorpora consultas reales por Supabase MCP, una migración de lectura pública autorizada y pruebas locales/remotas y E2E con fixtures efímeros. No se implementaron publicaciones ni se desplegó en Vercel; el cierre de Fase 2 sigue siendo una dependencia.

## Trazabilidad

| Fuente | Elementos cubiertos |
| --- | --- |
| Roadmap | Storage → Sprint 2.1; crear publicación → 2.2; listar y detalle → 3.1; editar → 4.1; eliminar → 4.2; salida CRUD completo → 5.1. Sprint 1.1 controla dependencias y 1.2 prepara las garantías de datos. |
| Backlog | `VIA-009` → 2.1; `VIA-010` → 2.2; `VIA-011`, `VIA-012` → 3.1; `VIA-013` → 4.1; `VIA-014` → 4.2. `VIA-004`, `VIA-005` se reutilizan para esquema/RLS de publicaciones en 1.2, sin reabrir la base ya cerrada. |
| Requisitos | `RF-03`, `RF-04`, `RF-05`; `RF-02` solo para publicaciones en perfil; `RF-06` solo como referencia obligatoria de categoría; `RNF-01` a `RNF-06`; reglas de propiedad de la ERS; [modelo de datos](../inicio/04-modelo-datos.md), [seguridad](../inicio/05-seguridad-y-autorizacion.md), [arquitectura](../inicio/03-arquitectura.md), [acciones](../inicio/08-api-y-server-actions.md), [UI/UX](../inicio/09-ui-ux.md) y [testing](../inicio/11-testing.md). |
| Proyecto | Pantallas 3, 4 y 5 → 2.2 y 3.1; galería y acciones de pantalla 7 → 3.1, 4.1 y 4.2. Pantallas 1 y 2 se conservan; 6 y 8 se trazan como diferidas, no implementadas. |

### Cobertura de las ocho vistas diseñadas

| Pantalla de Proyecto | Ruta de referencia → ruta base | Comprobación y fase responsable |
| --- | --- | --- |
| 1. Splash / bienvenida | `/` → `/` | Conservar marca, slogan y accesos de Fase 1; comprobar navegación y regresión en 3.1 y 5.1. No rehacer la portada. |
| 2. Login / registro | `/login`, `/register` → `/sign-in`, `/sign-up` | Conservar Clerk y Google existentes; comprobar retorno a la operación solicitada y logout en 5.1. Alias y selección Estudiante/Docente requieren decisión; no cambiar autenticación aquí. |
| 3. Home / feed | `/home` → `/inicio` | Imagen, título, autor y publicaciones recientes paginadas en 3.1. Hashtags destacados, buscador y comunidad quedan diferidos a Fase 5; no mostrar controles falsamente funcionales. |
| 4. Crear / publicar | `/crear` → `/crear` | Selector de imagen y formulario en 2.1 y 2.2. Categoría obligatoria según ERS; comunidad y hashtags no se vuelven obligatorios sin modificar primero la especificación. |
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
| Bloqueo | Fase 2 aún no satisface su salida: revisión manual de edición, avatar y autorización integral pendientes. | Cerrar sus sprints 2.1, 2.2 y 3.1 con evidencia en su documento. No iniciar migraciones ni código de publicaciones antes. |
| Decisión pendiente | Proyecto presenta hashtags obligatorios; ERS y UI base exigen categoría y dejan etiquetas opcionales. El modelo no contiene hashtags. | En 1.1 aprobar categoría obligatoria para Fase 3 y diferir hashtags a Fase 5. Si se exige adelantarlos, actualizar primero roadmap, modelo, requisitos y backlog; no ampliar silenciosamente esta fase. |
| Decisión pendiente | Proyecto llama rol a Estudiante/Docente, pero los permisos existentes usan `user`, `moderator`, `admin`. | Tratar Estudiante/Docente como posible atributo educativo, nunca como privilegio. No añadirlo sin contrato y actualización de Fase 2/base; el CRUD usa roles persistidos existentes. |
| Decisión pendiente | Rutas de Proyecto difieren de las implementadas y de la estructura base. | Aprobar la correspondencia de vistas anterior en 1.1; conservar rutas existentes. No crear aliases ni cambiar retornos globales sin decisión explícita. |
| Dependencia | `category_id` obligatorio necesita un catálogo antes de Fase 5; `community_id` apunta a una tabla todavía ausente. | Aprobar en 1.1 solo `categories` mínimo y seed versionado de Historia, Ciencia, Arte, Tecnología y Matemáticas. Diferir `community_id` y su FK hasta que exista `communities`; registrar este incremento del modelo antes de migrar. |
| Decisión pendiente | Falta contrato preciso de longitud, archivos, visibilidad, estado y borrado. | Acordarlo en 1.1 y reflejarlo en la base. Propuesta para revisión: título de 1–120 caracteres tras trim, descripción de 0–2000; JPEG/PNG/WebP hasta 5 MiB, dimensiones máximas de 4096 por eje. No son decisiones implementadas. |
| Riesgo | Un bucket público puede revelar cargas pendientes, publicaciones retiradas o archivos borrados solo en metadata. | Definir primero la visibilidad. Propuesta: lectura pública solo de publicaciones confirmadas y objetos asociados; cargas pendientes privadas. No suponer que RLS de tablas protege URLs públicas; definir entrega y caducidad de URLs firmadas cuando correspondan. |
| Riesgo | La autoría utiliza `profiles.id`, mientras Storage y Clerk reconocen el `sub` textual. | Resolver el perfil en servidor, derivar rutas del `sub` y probar la asociación; no aceptar `user_id`, propietario, estado ni URL externa del formulario. |
| Riesgo | Probar un feed público mediante joins podría ampliar lectura de perfiles privados. | Consumir únicamente la proyección pública de Fase 2; verificar también REST/RPC directo, no solo tipos o UI. |
| Riesgo | Escribir metadata y objetos no es una única transacción; reintentos, edición o eliminación pueden dejar residuos. | Definir idempotencia, compensación y recuperación observable antes del upload. No informar éxito de limpieza cuando haya tareas pendientes; verificar residuos por sprint. |
| Decisión pendiente | La seguridad base contempla moderación según alcance, pero no hay comunidades asignadas ni panel todavía. | En 1.1 fijar matriz propia para Fase 3 y diferir mutaciones ajenas privilegiadas a Fase 7. Un `moderator` no recibe permiso global implícito. Cualquier excepción admin debe documentarse y probarse antes de habilitarse. |
| Dependencia externa | Supabase y Clerk pueden haber cambiado desde las pruebas de septiembre/octubre; Preview y Production comparten temporalmente servicios. | Revalidar en entorno autorizado sin datos reales; probar objetos en entorno aislado. SQL reversible no revierte objetos Storage. No ejecutar reset o rollback destructivo contra el remoto compartido. |
| Dependencia externa | Vercel requiere configuración compatible para servir imágenes y retornar desde autenticación. | Validar local primero; Preview/Production solo con autorización explícita, sin versionar secretos ni URLs firmadas de usuarios. |

## Hito 1 — Dependencias y barrera de datos comprobables

### Sprint 1.1 — Cierre previo y contrato aprobado

**Objetivo:** disponer de evidencia del cierre de usuarios y decisiones aprobadas antes de escribir el CRUD.

**Alcance**

- [ ] Verificación documental del cierre de Fase 2, sin absorber su trabajo.
- [ ] Contrato aprobado de rutas, campos, imagen, visibilidad, categoría y permisos.
- [ ] Matriz de vistas actuales, incrementos y elementos diferidos.

**Tareas**

- [ ] `Sin identificador existente` Confirmar cierre de Fase 2 y enlazar sus evidencias; si sigue abierta, registrar bloqueo y detener el avance a 1.2.
- [ ] `Sin identificador existente` Aprobar o resolver las decisiones pendientes de esta fase; actualizar documentos base afectados antes de implementar.
- [ ] `VIA-010` Especificar campos, normalización, límites, obligatoriedad, estados publicables, errores y clave de idempotencia.
- [ ] `VIA-009` Definir formatos, bytes y dimensiones máximos, validación real de contenido, rutas, visibilidad, recuperación y borrado de archivos.
- [ ] `VIA-011` Acordar lectura pública/privada, orden reciente con desempate por ID, tamaño de página y proyección pública de autor.
- [ ] `VIA-013` `VIA-014` Fijar matriz de propiedad y permisos directos; definir ruta de edición propuesta `/post/[id]/editar` y confirmación de borrado.
- [ ] `Sin identificador existente` Aprobar catálogo mínimo de categorías y aplazamiento de comunidad/hashtags; documentar dependencia de Fase 5.

**Criterios de aceptación**

- [ ] CA-1.1.1 — Fase 2 está cerrada con evidencia, o el bloqueo impide expresamente comenzar 1.2.
- [ ] CA-1.1.2 — No quedan decisiones abiertas necesarias para esquema, Storage o CRUD; contrato y documentos base son coherentes.
- [ ] CA-1.1.3 — Las ocho pantallas tienen destino y fase responsable, sin controles prometidos que no se implementarán.

**Pruebas**

- [ ] P-1.1.1 — Unitarias: no aplica; se aprueban contratos, sin código (CA-1.1.2).
- [ ] P-1.1.2 — Integración documental: contrastar salida y evidencias de Fase 2, permisos y dependencias del modelo; comprobar la puerta de avance (CA-1.1.1, CA-1.1.2).
- [ ] P-1.1.3 — E2E documental: recorrer las ocho vistas en un guion de navegación, incluyendo login, alta pendiente y destinos diferidos (CA-1.1.3).
- [ ] P-1.1.4 — Seguridad/RLS: revisar la matriz de lectura/escritura para anónimo, A, B, moderador y admin; sin ejecutar servicios en este sprint documental (CA-1.1.2).

**Evidencia de cierre**

- Pendiente.

### Sprint 1.2 — Esquema de publicaciones y RLS directa

**Objetivo:** demostrar en PostgreSQL que solo se admiten publicaciones válidas y operaciones autorizadas.

**Alcance**

- [ ] Migración incremental de `posts` y catálogo mínimo aprobado, con restricciones e índices.
- [ ] RLS, privilegios de columnas y proyecciones seguras para consultas.
- [ ] Rollback/reaplicación sin pérdida de datos de usuarios.

**Tareas**

- [ ] `VIA-004` Crear esquema según contrato aprobado: autor referenciado a `profiles`, categoría existente, título, descripción, referencia de imagen, estado y timestamps; no crear tablas sociales anticipadas.
- [ ] `VIA-004` Versionar catálogo mínimo y restricciones de campos; preservar identidad, autor y timestamps no editables.
- [ ] `VIA-004` Añadir índices para orden reciente, autor y categoría y probar paginación estable con fechas iguales.
- [ ] `VIA-005` Resolver `profiles.id` desde el `sub` Clerk y aplicar la matriz aprobada de `SELECT`, `INSERT`, `UPDATE`, `DELETE`, incluidos `USING` y `WITH CHECK`.
- [ ] `VIA-005` Limitar lectura pública al estado aprobado y evitar filtración de campos privados del autor; no usar `service_role` en consultas ordinarias.
- [ ] `VIA-004` Documentar rollback incremental, precondiciones y respaldo si hubiera datos; ensayar en base desechable y mantener intacto el catálogo de perfiles.

**Criterios de aceptación**

- [ ] CA-1.2.1 — Base limpia y actualización desde Fase 2 obtienen restricciones, catálogo e índices esperados; referencias inexistentes y datos inválidos se rechazan.
- [ ] CA-1.2.2 — A solo escribe lo autorizado como A; B, anónimo, claims ausentes/malformados y roles no autorizados no pueden modificar filas ajenas ni reasignar autoría.
- [ ] CA-1.2.3 — Lecturas públicas muestran solo contenido permitido y autor público, sin `clerk_user_id` ni datos privados.
- [ ] CA-1.2.4 — Rollback y reaplicación preservan perfiles y reproducen el catálogo de la fase, sin fixtures residuales.

**Pruebas**

- [ ] P-1.2.1 — Unitarias/SQL: límites, normalización, estados, FK inválidas e inmutabilidad; no duplicar lógica SQL en una utilidad ficticia (CA-1.2.1, CA-1.2.2).
- [ ] P-1.2.2 — Integración: migrar base limpia y base de Fase 2; consultar catálogo, seed y paginación con empates; revertir/reaplicar y comparar objetos (CA-1.2.1, CA-1.2.4).
- [ ] P-1.2.3 — E2E: no aplica aún; no hay UI de publicaciones. El flujo se verificará en 2.2 y 3.1.
- [ ] P-1.2.4 — Seguridad/RLS: matriz SQL directa de CRUD con A/B, anónimo, moderador/admin según contrato, `sub` inválido y cambios de propietario; comprobar REST/RPC y columnas públicas (CA-1.2.2, CA-1.2.3).

**Evidencia de cierre**

- Pendiente.

## Hito 2 — Imagen publicada y persistente

### Sprint 2.1 — Storage seguro y carga recuperable

**Objetivo:** subir una imagen válida a una ruta propia sin exposición prematura ni escritura ajena.

**Alcance**

- [ ] Bucket `posts`, políticas y configuración de imagen versionados.
- [ ] Carga validada en servidor y componente accesible reutilizable en `/crear`.
- [ ] Recuperación de fallos y limpieza de cargas canceladas.

**Tareas**

- [ ] `VIA-009` Reutilizar las utilidades de imagen/Storage de Fase 2 donde proceda, manteniendo límites específicos del contrato de publicaciones.
- [ ] `VIA-009` Versionar bucket y políticas de lectura/escritura; usar ruta derivada de identidad y nombre no reutilizado, sin aceptar rutas del cliente.
- [ ] `VIA-009` Validar bytes, tipo real, tamaño y dimensiones; rechazar SVG, contenido incompatible, archivo vacío y formato fuera del contrato.
- [ ] `VIA-009` Implementar selector, previsualización, cancelación, estado pendiente y mensajes de error; el arrastre no será la única vía.
- [ ] `VIA-009` Vincular cargas a una operación/propietario verificables y definir caducidad, compensación y recuperación de pendientes sin borrado global.
- [ ] `VIA-009` Ensayar rollback de configuración/políticas y limpieza de objetos de prueba en Storage aislado; no confiar solo en rollback SQL.

**Criterios de aceptación**

- [ ] CA-2.1.1 — Imagen válida queda almacenada como propia; los límites aprobados se cumplen también en servidor y bucket.
- [ ] CA-2.1.2 — Archivo inválido, sesión ausente/expirada y ruta ajena no crean un objeto usable ni exponen datos internos.
- [ ] CA-2.1.3 — A no puede leer cargas privadas, sobrescribir o eliminar objetos de B; lectura de objetos publicados respeta el contrato aprobado.
- [ ] CA-2.1.4 — Cancelación, reintento y fallo parcial tienen recuperación comprobada; rollback y cleanup dejan cero objetos de prueba residuales.
- [ ] CA-2.1.5 — El selector es utilizable con teclado, muestra errores anunciables y no desborda móvil, tablet o escritorio.

**Pruebas**

- [ ] P-2.1.1 — Unitarias: contenido/MIME discordante, formato, ruta, dimensiones y valores justo por debajo, igual y por encima de cada límite aprobado (CA-2.1.1, CA-2.1.2).
- [ ] P-2.1.2 — Integración: carga válida, cancelación, doble envío y errores de red/Storage; verificar compensación, rollback y cero residuos (CA-2.1.1, CA-2.1.4).
- [ ] P-2.1.3 — E2E: seleccionar por teclado y arrastre, visualizar preview, cancelar, corregir archivo inválido y reintentar; comprobar 360, 768 y 1280 px (CA-2.1.5).
- [ ] P-2.1.4 — Seguridad/RLS/Storage: acceso directo A/B/anónimo, token inválido, ruta manipulada, lectura de pendientes y sobrescritura; comprobar también URL de entrega, no solo API de listado (CA-2.1.2, CA-2.1.3).

**Evidencia de cierre**

- Pendiente.

### Sprint 2.2 — Crear una publicación sin duplicados

**Objetivo:** completar `/crear` y obtener una publicación confirmada con imagen y metadata coherentes.

**Alcance**

- [ ] Formulario del wireframe adaptado al contrato aprobado.
- [ ] Acción `createPost` con validación, identidad, categoría e imagen propia.
- [ ] Confirmación persistente y errores recuperables sin duplicados.

**Tareas**

- [ ] `VIA-010` Crear validador compartido y acción de servidor; derivar autor de sesión/perfil y comprobar categoría y referencia de imagen propias.
- [ ] `VIA-010` Construir `/crear` con imagen, título, descripción y categoría; omitir comunidad/hashtags activos hasta su fase.
- [ ] `VIA-010` Revalidar sesión y perfil al enviar, gestionar doble envío y reintento idempotente, y devolver identificador confirmado.
- [ ] `VIA-010` Ordenar upload/confirmación según contrato y compensar fallos; no publicar objetos pendientes por tener una URL.
- [ ] `VIA-010` Mostrar confirmación mínima con ID real y revalidar las consultas afectadas; el enlace al detalle se incorporará en 3.1.
- [ ] `Sin identificador existente` Registrar etapa y código de fallo sin tokens, contenido privado, rutas firmadas ni mensajes internos; no convertir un error de persistencia en éxito.

**Criterios de aceptación**

- [ ] CA-2.2.1 — Usuario con perfil y datos válidos obtiene exactamente una fila propia y una imagen asociada; ambos persisten tras recarga.
- [ ] CA-2.2.2 — Falta de imagen/título/categoría, categoría inexistente o referencia de objeto ajeno se rechazan sin publicación parcial.
- [ ] CA-2.2.3 — Sesión ausente/expirada o perfil ausente impiden publicar, aunque se invoque directamente la acción.
- [ ] CA-2.2.4 — Doble envío, pérdida de respuesta y fallo de inserción/confirmación no duplican publicación ni esconden limpieza pendiente.
- [ ] CA-2.2.5 — Formulario tiene labels, foco, errores de campo y estado pendiente accesibles; funciona a 360, 768 y 1280 px.

**Pruebas**

- [ ] P-2.2.1 — Unitarias: campos y límites exactos del contrato; normalización y clasificación segura de errores (CA-2.2.2, CA-2.2.4).
- [ ] P-2.2.2 — Integración: acción + PostgreSQL + Storage, flujo válido, categorías inválidas, doble envío, respuesta perdida y fallos parciales; inspeccionar filas y objetos (CA-2.2.1, CA-2.2.2, CA-2.2.4).
- [ ] P-2.2.3 — E2E: login → `/crear` → corregir error → publicar → confirmación → recarga; comprobar teclado y responsive (CA-2.2.1, CA-2.2.5). `E2E-02` completo se cierra en 3.1.
- [ ] P-2.2.4 — Seguridad/RLS: invocar sin sesión/perfil, con sesión expirada, autor alterado y archivo B; comprobar rechazo directo en PostgreSQL/Storage (CA-2.2.2, CA-2.2.3).

**Evidencia de cierre**

- Pendiente.

## Hito 3 — Vistas de lectura conectadas a datos reales

### Sprint 3.1 — Feed, detalle y galerías propias

**Objetivo:** comprobar las pantallas 3, 5 y 7 con datos persistentes, imagen y autor público correctos.

**Alcance**

- [ ] `/inicio`, `/post/[id]`, `/imagenes` y sección de publicaciones en `/perfil`.
- [ ] Tarjetas reutilizables, listado paginado y conteos reales.
- [ ] Estados de carga, vacío, inexistente/no visible y servicio no disponible.

**Tareas**

- [ ] `VIA-011` Centralizar consultas tipadas fuera de componentes visuales y reutilizar la proyección pública de perfiles.
- [ ] `VIA-011` Implementar feed reciente con cursor estable y galerías filtradas por propietario; no descargar todo para filtrar en el navegador.
- [ ] `VIA-012` Implementar detalle y acceso a imagen original con el mismo permiso; validar ID y distinguir error de servicio de inexistencia.
- [ ] `VIA-011` Incorporar galería y conteo real en perfil propio; mantener edición de perfil existente separada de edición de post.
- [ ] `VIA-011` `VIA-012` Mostrar imagen, título, autor, descripción y categoría; mantener buscador, hashtags e interacciones diferidos sin botones engañosos.
- [ ] `Sin identificador existente` Conectar portada/acceso, feed, crear y volver; conservar retorno tras login. Dejar acciones editar/eliminar para sus sprints, sin enlaces rotos.
- [ ] `Sin identificador existente` Optimizar imágenes con dimensiones estables, alternativa textual y origen permitido; asegurar contraste, foco y responsive.

**Criterios de aceptación**

- [ ] CA-3.1.1 — Publicación confirmada aparece en feed, detalle y galería de A, con autor público correcto y conteo persistente; no aparece como propia en B.
- [ ] CA-3.1.2 — Paginación no repite ni omite filas en un dataset estable con timestamps iguales; vacío, ID inválido y publicación inexistente/no visible tienen respuesta controlada.
- [ ] CA-3.1.3 — Fallo de datos o de entrega de imagen se presenta como error recuperable, no como feed vacío exitoso; no se filtran campos privados.
- [ ] CA-3.1.4 — Las vistas respetan el contrato público/privado y el original no evade permisos; navigation/login/logout no regresan.
- [ ] CA-3.1.5 — Tarjetas, detalle y galerías no desbordan a 360, 768 y 1280 px, son utilizables con teclado y muestran imágenes sin saltos de layout evitables.

**Pruebas**

- [ ] P-3.1.1 — Unitarias: proyecciones públicas, cursor, ID y transformación de estados incluyendo imagen no disponible (CA-3.1.2, CA-3.1.3).
- [ ] P-3.1.2 — Integración: publicaciones A/B, consultas propias, públicas, orden con empates, varias páginas y error de Supabase/Storage (CA-3.1.1 a CA-3.1.4).
- [ ] P-3.1.3 — E2E: completar `E2E-02`, ir de feed a detalle y volver, visitar perfil/galería, recargar y repetir con B/anónimo según contrato; comprobar acceso y logout (CA-3.1.1, CA-3.1.4).
- [ ] P-3.1.4 — Seguridad/RLS/Storage: consultas directas, payloads y URLs del original no exponen publicaciones privadas, cargas pendientes o datos internos del autor (CA-3.1.3, CA-3.1.4).
- [ ] P-3.1.5 — Accesibilidad/responsive: teclado, jerarquía, textos alternativos, foco, contraste y capturas en los tres anchos definidos (CA-3.1.5).

**Evidencia de cierre**

- Pendiente.

## Hito 4 — Publicaciones propias administrables

### Sprint 4.1 — Editar datos e imagen sin perder el original

**Objetivo:** editar una publicación propia y actualizar todas sus vistas sin modificar recursos ajenos.

**Alcance**

- [ ] Formulario de edición y acción `updatePost`.
- [ ] Reemplazo opcional de imagen con compensación.
- [ ] Enlaces de edición propios en detalle y galerías.

**Tareas**

- [ ] `VIA-013` Cargar datos autorizados y reutilizar formulario/validadores de creación; conservar autor, ID y campos internos.
- [ ] `VIA-013` Comprobar sesión y propiedad en servidor y en la mutación RLS; no confiar en controles ocultos.
- [ ] `VIA-013` Definir control de concurrencia conforme al contrato y avisar de edición obsoleta en lugar de perder cambios silenciosamente.
- [ ] `VIA-013` Cargar imagen nueva, confirmar referencia y retirar la anterior en el orden aprobado; mantener original ante fallo y registrar cleanup pendiente si procede.
- [ ] `VIA-013` Revalidar feed, detalle, galería y perfil; preservar accesibilidad y mensajes recuperables.

**Criterios de aceptación**

- [ ] CA-4.1.1 — A edita campos válidos y opcionalmente la imagen; todos los listados y el detalle muestran el resultado persistente.
- [ ] CA-4.1.2 — Datos inválidos, categoría inexistente y edición obsoleta no sobrescriben la versión válida y muestran error comprensible.
- [ ] CA-4.1.3 — B, anónimo y roles sin permiso aprobado no editan A ni reasignan autor/imagen; URL y acción directa también rechazan el intento.
- [ ] CA-4.1.4 — Fallo de Storage/base o pérdida de sesión conservan una publicación recuperable sin pérdida del original ni residuos no registrados.
- [ ] CA-4.1.5 — Edición funciona con teclado y en los tres anchos definidos, incluidos estado pendiente y foco de error.

**Pruebas**

- [ ] P-4.1.1 — Unitarias: campos editables, límites, versión obsoleta y errores; autor e ID quedan fuera de entrada editable (CA-4.1.2, CA-4.1.3).
- [ ] P-4.1.2 — Integración: editar con/sin imagen, dos ediciones concurrentes, fallo de carga/confirmación/limpieza y sesión expirada; comprobar referencias y objetos (CA-4.1.1, CA-4.1.2, CA-4.1.4).
- [ ] P-4.1.3 — E2E: `E2E-05` y `E2E-06`, recarga y verificación en feed/perfil; teclado y responsive (CA-4.1.1, CA-4.1.3, CA-4.1.5).
- [ ] P-4.1.4 — Seguridad/RLS/Storage: actualizar fila A como B, cambiar autor, vincular objeto ajeno y reemplazar directamente archivo ajeno (CA-4.1.3).

**Evidencia de cierre**

- Pendiente.

### Sprint 4.2 — Eliminar con confirmación y limpieza verificable

**Objetivo:** retirar una publicación propia y recuperar fallos de borrado sin éxito ficticio.

**Alcance**

- [ ] Confirmación accesible y acción `deletePost` idempotente.
- [ ] Retirada de listados, detalle y conteo propio.
- [ ] Limpieza de imagen y recuperación ante errores parciales.

**Tareas**

- [ ] `VIA-014` Incorporar confirmación explícita, cancelar sin cambios y prevenir doble envío.
- [ ] `VIA-014` Comprobar sesión, propiedad y referencia almacenada; nunca borrar una ruta aportada por el cliente.
- [ ] `VIA-014` Ejecutar el protocolo aprobado de retirada y limpieza; diferenciar contenido retirado, limpieza pendiente y eliminación terminada.
- [ ] `VIA-014` Hacer reintentos seguros, preservar contexto de recuperación y registrar fallos sin secretos.
- [ ] `VIA-014` Revalidar feed, detalle, galería y conteo; verificar caducidad o invalidación de entrega de imagen según contrato, sin prometer borrar copias descargadas.

**Criterios de aceptación**

- [ ] CA-4.2.1 — Confirmar retira la publicación de las vistas y limpia su objeto; cancelar conserva fila e imagen.
- [ ] CA-4.2.2 — B, anónimo y roles no autorizados no eliminan fila ni objeto de A, aun manipulando ID/ruta.
- [ ] CA-4.2.3 — Repetir la operación no afecta otras publicaciones; errores parciales se notifican y pueden resolverse hasta cero residuos.
- [ ] CA-4.2.4 — Detalle retirado, conteos y URL de imagen cumplen el contrato después del borrado y su ventana de caducidad definida.
- [ ] CA-4.2.5 — Confirmación anuncia alcance y errores, gestiona foco y funciona con teclado y responsive.

**Pruebas**

- [ ] P-4.2.1 — Unitarias: estados de borrado/reintento, clasificación de fallos y selección de referencia almacenada (CA-4.2.2, CA-4.2.3).
- [ ] P-4.2.2 — Integración: confirmar/cancelar, doble intento, fallo de base/Storage/limpieza; inspeccionar filas, referencias, cero residuos finales y caducidad de acceso (CA-4.2.1, CA-4.2.3, CA-4.2.4).
- [ ] P-4.2.3 — E2E: A elimina desde galería, vuelve a feed, visita detalle anterior y verifica conteo; cancelar y navegar por teclado en tres anchos (CA-4.2.1, CA-4.2.4, CA-4.2.5).
- [ ] P-4.2.4 — Seguridad/RLS/Storage: borrar A como B/anónimo, manipular ruta e intentar reutilizar URL retirada según contrato (CA-4.2.2, CA-4.2.4).

**Evidencia de cierre**

- Pendiente.

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
- [ ] `Sin identificador existente` Verificar versiones de las guías locales de Next.js antes de implementar APIs/rutas y documentar solo decisiones realmente aprobadas.
- [ ] `Sin identificador existente` Registrar comandos, entorno autorizado, resultados, capturas sin datos sensibles, recuperación de fallos y ausencia de fixtures. Despliegue solo si se autoriza explícitamente.

**Criterios de aceptación**

- [ ] CA-5.1.1 — CRUD completo demostrado con filas/objetos persistentes y equivalencia de permisos en UI, acciones, PostgreSQL y Storage.
- [ ] CA-5.1.2 — Perfiles, avatar, roles, acceso y logout conservan los comportamientos de Fases 1 y 2; tipos, lint, build, pruebas y secretos pasan.
- [ ] CA-5.1.3 — Migraciones reproducibles, rollback probado y cleanup final sin usuarios, filas ni objetos de prueba residuales.
- [ ] CA-5.1.4 — Las vistas cubiertas tienen evidencia responsive/accesible; las diferidas están documentadas sin aparentar estar terminadas.
- [ ] CA-5.1.5 — La salida del roadmap está respaldada por evidencia fechada y decisiones actualizadas, no solo por casillas.

**Pruebas**

- [ ] P-5.1.1 — Unitarias: ejecutar suites relacionadas de perfiles, validadores de imagen/publicación y estados de error (CA-5.1.2).
- [ ] P-5.1.2 — Integración: regresión de acciones, auth-boundary, RLS de perfiles y publicaciones, Storage, migraciones y rollback; comprobar cero fixtures (CA-5.1.1 a CA-5.1.3).
- [ ] P-5.1.3 — E2E: recorrido CRUD completo A/B, `E2E-01`, `E2E-02`, `E2E-05`, `E2E-06`, acceso directo anónimo y sesiones expiradas; accesibilidad y tres anchos (CA-5.1.1, CA-5.1.2, CA-5.1.4).
- [ ] P-5.1.4 — Seguridad/RLS/Storage: repetir matriz aprobada, inspeccionar entrega de originales, payloads, logs y bundle; sin acceso ordinario con credenciales administrativas (CA-5.1.1, CA-5.1.2).
- [ ] P-5.1.5 — Verificación documental: contrastar cobertura del roadmap, backlog, ocho vistas, CA→P y decisiones aprobadas con evidencia de cada sprint (CA-5.1.4, CA-5.1.5).

**Evidencia de cierre**

- Pendiente.

## Validación final de la fase

- [ ] Todos los criterios de aceptación están verificados.
- [ ] Pruebas unitarias, integración y E2E requeridas superadas.
- [ ] Permisos de aplicación, RLS y Storage verificados cuando aplican.
- [ ] Migraciones y procedimiento de rollback validados cuando aplican.
- [ ] Accesibilidad y responsive comprobados cuando existe UI.
- [ ] Documentación base actualizada si cambió una decisión.
- [ ] Criterio de salida del roadmap demostrado.
- [ ] Fase 2 cerrada con evidencia antes de iniciar implementación de publicaciones.
- [ ] Todos los puntos de Fase 3 del roadmap tienen sprint; cada CA tiene pruebas asociadas.
- [ ] Ningún elemento diferido de Proyecto se declara implementado ni se muestra como funcional.
- [ ] Pruebas finales dejan cero fixtures en Clerk, PostgreSQL y Storage.

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
