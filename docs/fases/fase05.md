# VIA — Fase 05: Comunidades y búsqueda

## Estado

- Estado: Planificada
- Roadmap: Fase 5
- Dependencias: Fases 1/2 completadas; CRUD y diseño de Fase 3 aceptados con deuda explícita; entrega funcional y cierre integrado de Fase 4 demostrados con excepciones de verificación; Clerk, PostgreSQL, Storage y RLS existentes; contratos del Sprint 1.1 aprobados antes de implementar.
- Criterio de salida: descubrimiento y organización mediante comunidades explorables, membresía propia, publicaciones asociadas y búsqueda/filtros por los campos aprobados, incluida navegación por hashtags, sin ampliar permisos sobre contenido ajeno.

**Entrada para otra sesión: «comenzar fase 5».** Empezar por el Sprint 1.1,
no por una migración. Este documento solo planifica: no crea tablas, datos,
rutas ni funcionalidades, ni autoriza operaciones remotas.

Leer los cierres de [Fase 3](fase03.md#revisión-de-cierre--2026-10-15) y
[Fase 4](fase04.md#sprint-51--cierre-enfocado-de-interacción). La primera
conserva comprobaciones ampliadas diferidas; la segunda conserva JWT real
vencido y rollback/reaplicación de likes sin aprobar. No reabrirlas ni
marcarlas superadas por arrastre. Si un cambio requiere tocar esa superficie,
delimitar la regresión y pedir una decisión antes de ejecutar lo diferido.

Antes de implementar, revisar Git sin descartar cambios y contrastar esquema
local/remoto. Las categorías iniciales y hashtags ya existen: no recrearlos.
El esquema local de publicaciones todavía no incluye `community_id`;
comunidades y membresías del modelo base son conceptuales. La ausencia
de una implementación local no sustituye comprobar el remoto.

## Objetivo

Permitir descubrir recursos educativos y organizarlos por comunidades,
categorías, autor y etiquetas, reutilizando publicaciones, perfiles e
interacciones existentes. Una persona podrá explorar una comunidad,
participar según el contrato aprobado y localizar publicaciones sin conocer
su URL.

Conservar `/inicio` en columna única con carga continua, `/imagenes` y
galerías por autor en grid solo-imágenes, y controles propios desde detalle.
No transformar el seguimiento en un feed personalizado. Cada incremento
recorre datos/permisos → lectura o acción → UI → evidencia verificable.

## Trazabilidad

| Fuente | Elementos cubiertos |
| --- | --- |
| Roadmap | Comunidades → 2.1; miembros → 3.1; publicaciones de comunidad → 4.1/4.2; categorías → 5.2 reutilizando catálogo existente; búsqueda → 5.1; filtros → 5.2; búsqueda/navegación por hashtags persistidos → 5.1/5.2; salida descubrimiento y organización → 6.1. Contratos y puertas → 1.1. |
| Backlog | `VIA-019` listar y `VIA-020` ver comunidad → 2.1; `VIA-021` unirse y `VIA-022` salir → 3.1. `VIA-023` → verificar/reutilizar las categorías creadas en Fase 3, no duplicar catálogo ni añadir panel administrativo. `VIA-024` buscar → 5.1; `VIA-025` filtrar categoría → 5.2. `VIA-037` aporta hashtags existentes; su navegación/búsqueda no tiene identificador específico. Asociación de publicaciones y cierre: Sin identificador existente; reutilizan `VIA-010`/`VIA-011`/`VIA-012`/`VIA-013`/`VIA-014` sin rehacer CRUD. `VIA-004`/`VIA-005` solo para incrementos de esquema/RLS. |
| Requisitos | [ERS](../inicio/01-ers.md): `RF-06`, `RF-07`, `RF-08`, `RF-09`; compatibilidad con `RF-02` a `RF-05` y `RF-10` a `RF-13`; `RNF-01` a `RNF-06`. [MVP](../inicio/02-alcance-y-mvp.md): comunidades, miembros, publicaciones y búsqueda/filtro por categoría. |
| Contratos base | [Arquitectura](../inicio/03-arquitectura.md), [modelo](../inicio/04-modelo-datos.md), [seguridad](../inicio/05-seguridad-y-autorizacion.md), [rutas](../inicio/06-estructura-nextjs.md), [flujos](../inicio/07-especificacion-funcional.md), [acciones](../inicio/08-api-y-server-actions.md), [UI](../inicio/09-ui-ux.md) y [testing](../inicio/11-testing.md). Actualizarlos con decisiones aprobadas antes del incremento correspondiente. |
| Superficies | `/comunidades`, `/comunidades/[id]` y `/explorar` como rutas propuestas por la documentación base; `/crear`, edición/detalle de post, feed y galerías conservados e integrados donde corresponda. No introducir rutas alternativas sin justificarlo. |

## Fuera de alcance

- Medallas, rankings y estadísticas de participación: Fase 6.
- Paneles administrativos, moderación, reportes, expulsiones y gestión
  administrativa de comunidades/categorías/roles: Fase 7 (`VIA-036` no
  se adelanta). Unirse/salir no concede administración ni moderación.
- Recomendaciones, tendencias calculadas y feed por seguidos: Fase 8.
- Generación o asistencia IA, autocompletado inteligente y búsqueda semántica.
- Comunidades privadas, invitaciones y nuevas reglas de visibilidad de
  publicaciones como alcance implícito. Si se requieren, resolverlo en 1.1
  y revisar el plan antes de implementar; no ocultar el cambio en una FK.
- Crear otra aplicación Clerk, Organizations, otro proyecto/base Supabase,
  buscador externo, reset de datos o credenciales administrativas en el
  flujo ordinario. Las comunidades son entidades de VIA, no nuevos tenants.
- Carga de imágenes de comunidad por iniciativa técnica. El campo/bucket
  conceptual no autoriza un uploader; su necesidad debe resolverse en 1.1.
- Commit, despliegue, configuración de producción o pruebas diferidas
  ejecutadas sin autorización específica.

## Riesgos y decisiones

| Tipo | Descripción | Mitigación o decisión requerida |
| --- | --- | --- |
| Bloqueo B-01 | Faltan contratos de comunidad: visibilidad, alta inicial, campos/límites, creador y ciclo de vida. | Resolver en 1.1. Proponer MVP de comunidades públicas; acordar provisión inicial autorizada sin inventar comunidades permanentes ni adelantar un panel. Definir FK, unicidad y borrado sin pérdida de posts. Bloquea 2.1, no esta planificación. |
| Bloqueo B-02 | “Miembros” no define privacidad de la lista ni permiso para publicar al entrar/salir. | Acordar conteo, estado propio, si hay listado público paginado y su proyección mínima; definir reglas para creador, reingreso, publicaciones previas y carreras. No asumir que unirse permite editar contenido ajeno. Bloquea 3.1 y 4.1/4.2. |
| Bloqueo B-03 | No están fijadas semántica ni límites de búsqueda/filtros. | Acordar campos, coincidencia de palabras/frases, tildes, mayúsculas, longitud, combinaciones AND/OR, autor por username/nombre público, orden, paginación y URL. Distinguir búsqueda textual de filtros exactos. Bloquea 5.1/5.2. |
| Bloqueo B-04 | Las autorizaciones remotas anteriores eran por incremento. | Pedir autorización específica antes de cada migración y pruebas con fixtures persistentes de esta fase. Preparar migración/rollback local y precondiciones; sin autorización, remoto bloqueado, no éxito supuesto. |
| Dependencia D-01 | Fases 3/4 tienen deuda técnica explícita aunque sus entregas funcionales estén aceptadas. | Mantener enlaces y casillas abiertas. Una validación integral sin excepciones sigue bloqueada por esa deuda; no bloquea acordar contratos. Ejecutar solo regresión pertinente autorizada, no reabrir toda la fase anterior. |
| Dependencia D-02 | Categorías/hashtags y contratos públicos ya tienen consumidores. | Reutilizar catálogo de cinco categorías y normalización Unicode de hashtags. Preservar DTO/grants/callers al extender RPC; inventariar dependencias y evitar firmas ambiguas. No exponer IDs de actor ni filas privadas por nuevas consultas. |
| Riesgo | Asociación de comunidad atraviesa leases, idempotencia, edición y confirmación de imágenes. | Incluir comunidad en payload/validación de operación; mantener tickets/posts anteriores sin comunidad y versión esperada. Reautorizar en confirmación y tras esperas, no solo al abrir formulario. |
| Riesgo | Salida de comunidad, publicación y edición concurrentes pueden divergir. | Definir resultado válido en 1.1; aplicar transacción/bloqueos con orden estable, comprobar sesión y membresía en DB y probar carreras, incluido creador si tiene tratamiento especial. |
| Riesgo | Búsqueda puede mezclar filtros/páginas o divulgar cargas pendientes. | Predicados autorizados antes de paginar/firmar imágenes; cursor ligado a consulta canónica; descartar respuestas tardías y cachear estado personal por actor, nunca compartido. |
| Riesgo | Consultas por texto/joins pueden escanear todo o duplicar posts. | Medir consultas representativas con evidencia de plan/tiempo y acordar presupuesto en 1.1. PostgreSQL primero; índices según predicados, agregados por lote, sin consultas por tarjeta ni dependencia nueva por anticipación. |
| Riesgo | Búsqueda en URL puede aparecer en logs y errores. | No registrar tokens, textos de búsqueda, borradores ni URLs firmadas; errores redactados por tipo/código. Entrada vacía, inválida, cero resultados y servicio indisponible son estados distintos. |
| Dependencia externa | Clerk/Supabase existentes y Vercel para despliegue posterior. | Solo claves de desarrollo para fixtures; confirmar autenticación y acceso sin imprimir secretos. `NEXT_PUBLIC_APP_ORIGIN` HTTPS debe configurarse antes del build desplegado; no dar por hecho Production ni deploy. |

Secuencia: 1.1 → 2.1 → 3.1 → 4.1 → 4.2; 5.1 depende de 1.1,
2.1 y 4.1 para buscar los campos comunitarios; 5.2 depende de 5.1.
6.1 depende de todos. Este orden no autoriza trabajo remoto automáticamente.
Si no se aprueba una decisión, conservar el incremento afectado bloqueado.

## Hito 1 — Contratos y puertas de implementación explícitos

### Sprint 1.1 — Acordar comunidades, membresía y descubrimiento

**Objetivo:** dejar implementables y verificables los contratos sin inventar
decisiones de producto ni ejecutar SQL.

**Alcance**

- [ ] Matriz aprobada A/B/anónimo/sin perfil/moderador/admin y creador.
- [ ] Contratos de comunidades, miembros, asociación de posts, búsqueda y URL.
- [ ] Dependencias, deuda, provisión inicial y autorización remota delimitadas.

**Tareas**

- [ ] `VIA-019` `VIA-020` `VIA-021` `VIA-022` Acordar B-01/B-02: datos y límites, provisión/creador, lectura pública, privacidad/lista de miembros, entrada/salida y conservación del contenido anterior.
- [ ] `VIA-024` `VIA-025` `Sin identificador existente` Acordar B-03: semántica por cada campo RF-08, texto y filtros combinados, vacíos/errores, orden y cursor. Proponer páginas de 12 y orden reciente estable reutilizando el patrón actual; fijar límites y presupuesto de consulta antes de medirlos.
- [ ] `VIA-010` `VIA-013` `Sin identificador existente` Definir comunidad opcional en creación/edición, elegibilidad, retirada de asociación, conflicto de versión y comportamiento si se abandona/elimina una comunidad. Resolver si imágenes de comunidad quedan fuera; no dejar un uploader condicional sin contrato.
- [ ] `VIA-004` `VIA-005` Inventariar esquema/RPC/políticas actuales y consumidores; definir migraciones incrementales, precondiciones y rollback protegido. Leer las guías de Next.js instaladas antes de escribir código.
- [ ] `Sin identificador existente` Registrar acuerdos aprobados en documentos base y separar lo propuesto de lo aceptado. Identificar qué falta autorizar y qué deuda no se ejecutará.

**Criterios de aceptación**

- [ ] CA-1.1.1 — B-01/B-02 tienen decisión explícita, límites y matriz de permisos; no quedan reglas contradictorias entre membresía y publicación.
- [ ] CA-1.1.2 — Cada campo de RF-08 y filtro/hashtag tiene semántica observable, límites, orden/página y casos de error documentados.
- [ ] CA-1.1.3 — Catálogo/hashtags previos y diseño se reutilizan; dependencias, deuda y alcance remoto no se presentan como aprobados por arrastre.

**Pruebas**

- [ ] P-1.1.1 — Unitarias: no aplica ejecución de código; revisar ejemplos válidos/inválidos y límites exactos para derivar tests de los siguientes incrementos (CA-1.1.1, CA-1.1.2).
- [ ] P-1.1.2 — Integración documental: contrastar modelo, acciones, flujos, rutas y esquema disponible, incluidos tickets/DTO anteriores y FK/rollback (CA-1.1.1 a CA-1.1.3).
- [ ] P-1.1.3 — E2E documental: recorrer A/B/anónimo desde comunidad hasta publicar, buscar, filtrar y volver por URL; verificar todos los campos RF-08 (CA-1.1.1, CA-1.1.2).
- [ ] P-1.1.4 — Seguridad/RLS: revisar la matriz y registrar aprobaciones/bloqueos; sin peticiones mutables ni pruebas remotas en este sprint de contratos (CA-1.1.1, CA-1.1.3).

**Evidencia de cierre**

- Pendiente.

## Hito 2 — Comunidades explorables con datos reales

### Sprint 2.1 — Listado y detalle públicos de comunidad

**Objetivo:** explorar comunidades existentes sin sesión y distinguir
ausencia, datos vacíos y fallo del servicio.

**Alcance**

- [ ] Entidad/proyección pública de comunidad, listado paginado y detalle.
- [ ] Navegación accesible desde superficies acordadas, sin controles ficticios.

**Tareas**

- [ ] `VIA-004` `VIA-005` Migrar `communities` con contrato aprobado, FK/índices/grants/RLS y rollback protegido. Resolver provisión inicial autorizada y trazabilidad del creador sin aceptar identidades del cliente.
- [ ] `VIA-019` `VIA-020` Implementar lectura pública acotada y validada, paginación estable y detalle por ID; no exponer filas privadas de perfiles ni credenciales.
- [ ] `VIA-019` `VIA-020` Integrar rutas previstas con estados carga/vacío/no encontrado/error y reintento. No anticipar botones de membresía/publicación ni cero contadores no implementados.
- [ ] `Sin identificador existente` Mantener la presentación de imagen aprobada; si no hay carga de imagen en el contrato, no crear bucket ni aceptar URLs arbitrarias. Registrar errores redactados.

**Criterios de aceptación**

- [ ] CA-2.1.1 — Listado/detalle muestran datos reales paginados y enlaces correctos; un ID ausente no muestra otra comunidad.
- [ ] CA-2.1.2 — Anónimo puede leer solo la proyección aprobada; escrituras ordinarias/ajenas y campos manipulados no amplían permisos.
- [ ] CA-2.1.3 — Vacío, fallo y no encontrado se distinguen; teclado, foco, contraste y 360/768/1280 conservan navegación sin desbordamiento.
- [ ] CA-2.1.4 — Migración/rollback no borran comunidades/perfiles reales ni duplican provisión; precondiciones y ensayo están documentados.

**Pruebas**

- [ ] P-2.1.1 — Unitarias: IDs, límites, DTO privado adulterado, paginación y estados/mensajes (CA-2.1.1 a CA-2.1.3).
- [ ] P-2.1.2 — Integración: esquema/provisión repetida, FK, empates de cursor, datos existentes y rollback/reaplicación transaccional cuando sus precondiciones lo permiten; rechazo con datos protegidos (CA-2.1.1, CA-2.1.4).
- [ ] P-2.1.3 — E2E: listado → detalle → volver, cero comunidades, destino ausente y fallo/reintento, teclado/responsive/contraste medido (CA-2.1.1, CA-2.1.3).
- [ ] P-2.1.4 — Seguridad/RLS: A/B/anónimo/sin perfil/roles y creador según matriz aprobada, acceso directo, entradas inválidas y proyección sin identidad Clerk (CA-2.1.2).

**Evidencia de cierre**

- Pendiente.

## Hito 3 — Participación propia y miembros autorizados

### Sprint 3.1 — Unirse y salir sin duplicados ni estado ajeno

**Objetivo:** participar en una comunidad con persistencia, conteo y
privacidad según B-02, sin gestión administrativa.

**Alcance**

- [ ] Membresía propia, estado deseado idempotente y conteo real.
- [ ] Superficie de miembros según contrato: si incluye lista, proyección pública paginada aprobada; si no, conteo/estado propio sin enumeración.

**Tareas**

- [ ] `VIA-004` `VIA-005` Migrar `community_members` con unicidad comunidad/perfil, índices por extremos, FK y rollback protegido según ciclo de vida aprobado; impedir campos/roles/propietario falsificados.
- [ ] `VIA-021` `VIA-022` Implementar entrada/salida propias derivando actor y validando sesión/perfil/destino en acción y DB. Exigir expiración numérica futura y `nbf` válido si existe, también después de esperar bloqueos.
- [ ] `VIA-021` `VIA-022` Confirmar estado deseado y conteos, conservar intención tras respuesta perdida y aislar estado/caché por actor. Reconciliar foco/visibilidad y revalidar superficies afectadas.
- [ ] `Sin identificador existente` Integrar miembros conforme al contrato cerrado en 1.1, incluidos creador y última membresía si hay regla especial. No añadir expulsiones, invitaciones ni moderación.

**Criterios de aceptación**

- [ ] CA-3.1.1 — Entrar/repetir/salir/reingresar no duplica filas ni conteos; recarga y dos pestañas confirman el estado vigente.
- [ ] CA-3.1.2 — Anónimo/sin perfil/sesión vencida y actor falsificado no mutan; B no lee ni retira estado privado de A, también con roles elevados.
- [ ] CA-3.1.3 — Miembros públicos y estado propio se limitan a la proyección aprobada; cambio de sesión o error no muestra estado previo ni cero ficticio.
- [ ] CA-3.1.4 — Teclado/responsive, pendiente, error y reintento funcionan; ciclo de vida y rollback conservan datos protegidos.

**Pruebas**

- [ ] P-3.1.1 — Unitarias: UUID/booleano estricto, autor/rol extra, sesión/perfil, DTO, mensajes, revalidación y aislamiento por actor (CA-3.1.1 a CA-3.1.3).
- [ ] P-3.1.2 — Integración: unicidad, estados concurrentes/repetidos, creador, conteos/FK y rollback protegido/reaplicación bajo precondiciones (CA-3.1.1, CA-3.1.4).
- [ ] P-3.1.3 — E2E: A/B/anónimo, recarga/cambio de cuenta/pestaña, respuesta perdida y teclado a 360/768/1280; lista solo si fue aprobada, con paginación y ausencia de extras (CA-3.1.1, CA-3.1.3, CA-3.1.4).
- [ ] P-3.1.4 — Seguridad/RLS: llamadas directas, firma inválida, JWT real válido y luego vencido sin cambios de conteo, `nbf` sintético y matriz de roles (CA-3.1.2, CA-3.1.3).

**Evidencia de cierre**

- Pendiente.

## Hito 4 — Publicaciones organizadas por comunidad

### Sprint 4.1 — Publicar en comunidad y explorar su contenido

**Objetivo:** crear una publicación asociada y verla en su comunidad,
conservando permisos, entrega de imagen y publicaciones anteriores.

**Alcance**

- [ ] Comunidad opcional en creación y publicaciones reales en el detalle de comunidad.
- [ ] Lecturas existentes compatibles, sin alterar el diseño de feed/galerías.

**Tareas**

- [ ] `VIA-004` `VIA-005` `Sin identificador existente` Añadir `community_id` opcional y FK/índices acordados a posts y a los datos operativos que lo necesiten. Preservar posts/tickets anteriores y SQL/RPC/grants/DTO existentes.
- [ ] `VIA-010` Integrar selección autorizada y validación en begin/commit de publicación, incluido payload idempotente. Revalidar sesión/membresía al confirmar, también si se abandona la comunidad mientras se carga.
- [ ] `VIA-011` `VIA-012` `VIA-020` Proyectar asociación pública y contenido de comunidad con cursor estable; actualizar consumidores de feed/detalle/galerías sin filtrar identidad privada ni firmar contenido no permitido.
- [ ] `Sin identificador existente` Reutilizar normalización, leases, journal y políticas Storage; no mover objetos ni duplicar publicaciones al asociarlas. Error conserva borrador y operación recuperable con mensaje honesto.

**Criterios de aceptación**

- [ ] CA-4.1.1 — Publicación nueva con/sin comunidad y reintento idempotente producen un solo post con asociación correcta; posts/tickets previos siguen utilizables.
- [ ] CA-4.1.2 — Solo actor elegible publica según B-02; comunidad inexistente, payload distinto, sesión/membresía retirada durante carga y llamadas directas no evaden reglas.
- [ ] CA-4.1.3 — Detalle de comunidad contiene solo sus posts permitidos, sin duplicados por joins; feed, detalle, galerías e interacciones conservan estado/diseño.
- [ ] CA-4.1.4 — Fallos de carga/confirmación/limpieza son observables y recuperables; firmas/objetos respetan permisos existentes y rollback no pierde asociaciones reales.

**Pruebas**

- [ ] P-4.1.1 — Unitarias: selección/UUID, payload/hash idempotente, versión de contrato, DTO y datos anteriores sin comunidad (CA-4.1.1, CA-4.1.2).
- [ ] P-4.1.2 — Integración: migración con posts/tickets existentes, begin/commit y carreras con salida/borrado de comunidad; índices/FK/grants y rollback protegido sin reset (CA-4.1.1, CA-4.1.2, CA-4.1.4).
- [ ] P-4.1.3 — E2E: unirse → crear → comunidad → detalle/feed/galerías, con recarga; salida durante carga y fallo/reintento que conserva borrador; teclado/responsive (CA-4.1.1 a CA-4.1.4).
- [ ] P-4.1.4 — Seguridad/RLS/Storage: anónimo/A/B/sin perfil/roles, autor y comunidad falsificados, carga pendiente/retirada, firma y objetos ajenos; no usar service role (CA-4.1.2 a CA-4.1.4).

**Evidencia de cierre**

- Pendiente.

### Sprint 4.2 — Editar asociación y conservar contenido al salir

**Objetivo:** cambiar o retirar la comunidad de un post propio con
concurrencia controlada, sin romper el ciclo de vida existente.

**Alcance**

- [ ] Edición propia de asociación, versión esperada y rutas revalidadas.
- [ ] Comportamiento aprobado al salir y al retirar comunidad/post.

**Tareas**

- [ ] `VIA-013` Integrar asociación en edición propia y RPC/restricciones, conservando comunidad al editar otros campos o reemplazar imagen. Reautorizar nuevo destino y aplicar compare-and-swap.
- [ ] `VIA-011` `VIA-012` `VIA-020` Actualizar comunidad anterior/nueva, detalle, feed y galerías tras mover/retirar asociación, sin persistir firmas ni alterar likes/comentarios.
- [ ] `VIA-014` `VIA-022` `Sin identificador existente` Cumplir la decisión de conservación de posts al salir/eliminar comunidad; borrar el post sigue retirando interacciones y journal propios, no la comunidad ni membresías ajenas.
- [ ] `VIA-004` `VIA-005` Versionar cualquier ajuste incremental necesario y su rollback; registrar conflictos y limpieza pendiente con el patrón existente.

**Criterios de aceptación**

- [ ] CA-4.2.1 — Mover/quitar asociación propia actualiza ambas vistas tras recarga, sin pérdida de imagen/interacciones; reemplazo de imagen no cambia comunidad accidentalmente.
- [ ] CA-4.2.2 — Edición obsoleta, tercero/rol elevado y pérdida de elegibilidad concurrente no sobreescriben ni mutan contenido ajeno.
- [ ] CA-4.2.3 — Salida/reingreso y retirada de comunidad/post respetan el ciclo de vida aprobado, conservan recursos ajenos y exponen limpieza pendiente si falla.

**Pruebas**

- [ ] P-4.2.1 — Unitarias: asociación omitida/nula/cambiada, versión, permisos, revalidación anterior/nueva y resultados de limpieza (CA-4.2.1 a CA-4.2.3).
- [ ] P-4.2.2 — Integración: carreras edición/salida/retirada, FK sin borrado accidental y rollback/reaplicación de ajustes bajo precondiciones (CA-4.2.2, CA-4.2.3).
- [ ] P-4.2.3 — E2E: A mueve/quita asociación, reemplaza imagen, recarga y retira post con interacciones; B conserva sus recursos; fallo recuperable, confirmación/cancelación y teclado (CA-4.2.1 a CA-4.2.3).
- [ ] P-4.2.4 — Seguridad/RLS: A/B/roles por acción y acceso directo, IDs/versión manipulados, sesión vencida y permisos de objetos antes/después (CA-4.2.2, CA-4.2.3).

**Evidencia de cierre**

- Pendiente.

## Hito 5 — Descubrimiento reproducible por texto y filtros

### Sprint 5.1 — Buscar publicaciones por todos los campos acordados

**Objetivo:** localizar contenido permitido desde `/explorar` sin cargar
todo el catálogo en cliente ni ampliar la lectura pública.

**Alcance**

- [ ] Búsqueda paginada por título, descripción, hashtags, categoría, comunidad y autor público conforme a B-03.
- [ ] URL reproducible, estados honestos y consultas medidas.

**Tareas**

- [ ] `VIA-024` `Sin identificador existente` Implementar consulta parametrizada en PostgreSQL con semántica aprobada; elegir índices por evidencia, sin dependencias externas especulativas. Nunca interpolar SQL ni exponer identidad Clerk del autor.
- [ ] `VIA-004` `VIA-005` Versionar funciones/índices/grants/RLS necesarios y rollback seguro. Aplicar predicados de visibilidad antes de paginar y firmar imágenes.
- [ ] `VIA-024` Integrar formulario etiquetado, URL canónica y carga incremental/alternativa accesible. Consulta nueva reinicia cursor y descarta respuestas anteriores; atrás/adelante/recarga recuperan la búsqueda.
- [ ] `Sin identificador existente` Distinguir inicial/vacío/entrada inválida/cero resultados/fallo, con reintento y logs redactados. Reutilizar tarjetas e interacciones sin N+1 ni caché personal compartida.

**Criterios de aceptación**

- [ ] CA-5.1.1 — Hay positivos/negativos verificables para cada campo de RF-08, Unicode/tildes según contrato y publicaciones anteriores con hashtags ya guardados.
- [ ] CA-5.1.2 — Orden/cursor son estables y pertenecen a la consulta; cambio rápido, atrás/adelante y recarga no mezclan páginas ni duplican posts por joins.
- [ ] CA-5.1.3 — Solo contenido autorizado aparece, incluso imagen/detalle compartido; textos manipulados no ejecutan código/SQL ni revelan datos privados.
- [ ] CA-5.1.4 — Errores se distinguen del vacío; teclado/responsive y contraste se verifican; consultas cumplen presupuesto aprobado medido, sin consultas por tarjeta.

**Pruebas**

- [ ] P-5.1.1 — Unitarias: cada campo, límites, normalización, caracteres `%`/`_`/comillas, parámetros/URL/cursor adulterados y descarte de respuesta tardía (CA-5.1.1 a CA-5.1.4).
- [ ] P-5.1.2 — Integración: fixtures con coincidencias separadas por campo, empates/joins, ediciones/retiros entre páginas, plan/tiempo/lotes medidos y rollback de índices/RPC sin alterar posts (CA-5.1.1, CA-5.1.2, CA-5.1.4).
- [ ] P-5.1.3 — E2E: buscar → siguiente página → detalle → volver, URL copiada en anónimo, cambio rápido, error/reintento, teclado/foco/contraste y 360/768/1280 (CA-5.1.1, CA-5.1.2, CA-5.1.4).
- [ ] P-5.1.4 — Seguridad/RLS/Storage: API directa, inputs hostiles, A/B/anónimo/sin perfil/roles, post pendiente/retirado y ausencia de tokens/IDs privados/firmas en logs y caché compartida (CA-5.1.3).

**Evidencia de cierre**

- Pendiente.

### Sprint 5.2 — Filtrar y navegar por categoría, comunidad, autor y hashtag

**Objetivo:** combinar la búsqueda con filtros exactos y abrir hashtags
existentes como destinos de descubrimiento reales.

**Alcance**

- [ ] Filtros combinables y retirables con URL/orden/cursor coherentes.
- [ ] Catálogo de categorías existente y navegación accesible por hashtags.

**Tareas**

- [ ] `VIA-023` `VIA-025` Consumir y comprobar el catálogo existente, sin recrear las cinco categorías ni añadir edición administrativa; filtrar por categoría válida y distinguir referencia ausente de error de lectura.
- [ ] `VIA-024` `Sin identificador existente` Integrar comunidad, autor público y hashtag según B-03, combinados con texto. Resolver IDs/username canónicos y renombrados sin sustituir silenciosamente el destino.
- [ ] `VIA-037` `Sin identificador existente` Enlazar hashtags de feed/detalle a resultados filtrados usando su valor canónico existente. Codificar Unicode/URL sin perder tildes/ñ; no añadir texto/controles sobre tiles del grid.
- [ ] `Sin identificador existente` Resetear paginación al cambiar cualquier filtro, permitir limpiar uno/todos, conservar URL al volver y descartar respuestas fuera de consulta/actor. Revalidar resultados afectados por edición/retiro.
- [ ] `VIA-004` `VIA-005` Versionar solo ajustes SQL necesarios con precondiciones y rollback, reutilizando el contrato de búsqueda en lugar de consultas duplicadas por pantalla.

**Criterios de aceptación**

- [ ] CA-5.2.1 — Texto y categoría/comunidad/autor/hashtag se combinan según la tabla aprobada, sin falsas coincidencias ni duplicados; quitar un filtro conserva los demás.
- [ ] CA-5.2.2 — Un hashtag previo abre resultados exactos y URL válida; Unicode, referencias ausentes e inputs inválidos no se convierten en búsquedas distintas sin avisar.
- [ ] CA-5.2.3 — Cambiar/limpiar filtros reinicia cursor; compartir URL, atrás/adelante, recarga y cambio de actor conservan consulta sin filtrar estado personal.
- [ ] CA-5.2.4 — Catálogo previo y diseño se conservan; controles accesibles, vacío/fallo/reintento y rendimiento combinado cumplen el contrato medido.

**Pruebas**

- [ ] P-5.2.1 — Unitarias: matriz de combinaciones, límites/IDs, URL Unicode, referencias/rename, filtro retirado y cursor de otra consulta (CA-5.2.1 a CA-5.2.3).
- [ ] P-5.2.2 — Integración: cinco categorías sin duplicación, autor/comunidad/etiqueta reales, cambios entre páginas y consultas combinadas medidas; grants/RLS/rollback de ajustes (CA-5.2.1, CA-5.2.2, CA-5.2.4).
- [ ] P-5.2.3 — E2E: hashtag del post → resultados → categoría/comunidad/autor → limpiar → detalle/volver, URL anónima, teclado/foco/contraste y 360/768/1280 (CA-5.2.1 a CA-5.2.4).
- [ ] P-5.2.4 — Seguridad/RLS: filtros manipulados no amplían visibilidad, resultados/imágenes retirados no reaparecen y caché/controles sociales no exponen otro actor (CA-5.2.2, CA-5.2.3).

**Evidencia de cierre**

- Pendiente.

## Hito 6 — Descubrimiento y organización demostrados

### Sprint 6.1 — Cierre integrado con datos y diseño conservados

**Objetivo:** demostrar el criterio de salida con A/B/anónimo y dejar
delimitada la fase siguiente sin cierres por arrastre.

**Alcance**

- [ ] Recorrido integrado de comunidad/membresía/publicación/búsqueda/filtros.
- [ ] Regresión afectada, evidencia reproducible, limpieza y documentación.

**Tareas**

- [ ] `VIA-019` `VIA-020` `VIA-021` `VIA-022` `VIA-024` `VIA-025` `Sin identificador existente` Recorrer entrar, publicar, localizar por cada campo/filtro, editar, salir y retirar según contrato; verificar contenido anterior y las cuatro interacciones existentes.
- [ ] `Sin identificador existente` Ejecutar unitarias afectadas, matrices SQL/HTTP y E2E enfocados; tipos/lint/build/escaneo al cierre pertinente, sin repetir suites completas sin causa.
- [ ] `VIA-004` `VIA-005` Contrastar migraciones/historial y ensayos de rollback de lo nuevo bajo sus precondiciones. No retirar datos reales para fabricar una tabla vacía ni resetear el proyecto compartido.
- [ ] `Sin identificador existente` Validar teclado/foco, contraste calculado y 360/768/1280 en estados normales/pendientes/error; conservar feed y galerías y comprobar ausencia de regresión de hidratación.
- [ ] `Sin identificador existente` Limpiar fixtures propios en orden compatible con FK y retirar objetos/usuarios temporales incluso si una prueba falla; comprobar baseline, journal y procesos propios detenidos, con fallos de cleanup explícitos.
- [ ] `Sin identificador existente` Actualizar documentos base y cierre con comandos/resultados, decisiones y deuda separada. Fase 6 será medallas/ranking/estadísticas; no implementarla en este cierre ni desplegar por iniciativa propia.

**Criterios de aceptación**

- [ ] CA-6.1.1 — Comunidades, miembros, asociación y búsqueda por todos los campos/filtros del roadmap funcionan juntas y con permisos equivalentes en UI, acciones y DB.
- [ ] CA-6.1.2 — CRUD/imagen, perfiles/avatar, sesión, likes/comentarios/compartir/seguir y diseño previo conservan comportamiento en superficies afectadas.
- [ ] CA-6.1.3 — Migraciones/RLS/Storage/rollback del nuevo alcance tienen evidencia, sin fixtures/procesos propios residuales ni pérdida de datos reales; simulación y remoto están diferenciados.
- [ ] CA-6.1.4 — Evidencia accesible/responsive/rendimiento y trazabilidad sostienen el cierre; deuda heredada y autorizaciones pendientes siguen explícitas, sin declarar deploy no realizado.

**Pruebas**

- [ ] P-6.1.1 — Unitarias: contratos y regresión de superficies afectadas, errores y límites exactos acordados (CA-6.1.1, CA-6.1.2).
- [ ] P-6.1.2 — Integración: matriz de roles/actor/creador, FK/carreras, consultas/páginas/firmas, historial/rollback autorizado y baseline/cleanup (CA-6.1.1 a CA-6.1.3).
- [ ] P-6.1.3 — E2E: A/B/anónimo, membresía → publicar → buscar/filtrar/hashtag → editar/salir/retirar, sesiones y cuatro interacciones; errores de red explícitos, teclado/foco/contraste y anchos aprobados (CA-6.1.1, CA-6.1.2, CA-6.1.4).
- [ ] P-6.1.4 — Seguridad/RLS: acceso directo con payload manipulado y sesión inválida/vencida, aislamiento por actor, recursos privados/retirados y escaneo de secretos; no sustituye las pruebas diferidas de likes (CA-6.1.1, CA-6.1.3).
- [ ] P-6.1.5 — Verificación documental: cobertura roadmap/backlog, cada CA con prueba, contratos aprobados, deuda Fases 3/4 sin casillas automáticas y siguiente fase delimitada (CA-6.1.4).

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
- [ ] Rendimiento/paginación medidos contra límites aprobados, sin filas privadas ni N+1.
- [ ] Datos reales conservados, cero fixtures y procesos propios residuales.
- [ ] Deuda heredada y resultados simulados/remotos diferenciados; commit/deploy solo con autorización.

## Registro de progreso

| Fecha | Sprint | Estado | Evidencia | Notas |
| --- | --- | --- | --- | --- |
| 2026-10-15 | 1.1 | Pendiente | — | Primer sprint listo para acordar contratos; no iniciado. B-01/B-02/B-03 por resolver. |
| 2026-10-15 | 2.1 | Pendiente | — | Depende de 1.1; B-04 antes de migración/fixtures remotos. |
| 2026-10-15 | 3.1 | Pendiente | — | Depende de 2.1 y contrato B-02; membresía propia, no administración. |
| 2026-10-15 | 4.1 | Pendiente | — | Depende de 3.1; compatibilidad con publicaciones/tickets anteriores. |
| 2026-10-15 | 4.2 | Pendiente | — | Depende de 4.1; edición/ciclo de vida según contrato aprobado. |
| 2026-10-15 | 5.1 | Pendiente | — | Depende de 1.1/2.1/4.1; búsqueda por todos los campos RF-08. |
| 2026-10-15 | 5.2 | Pendiente | — | Depende de 5.1; reutiliza categorías y hashtags existentes. |
| 2026-10-15 | 6.1 | Pendiente | — | Depende de todos; cierre con evidencia y deuda diferenciada. |
