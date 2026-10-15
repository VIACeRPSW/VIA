# VIA — Fase 04: Interacción

## Estado

- Estado: En curso — Sprint 1.1 consolidado el 2026-10-15; Sprint 1.2 implementado con validación local/remota y E2E, pendiente ensayo de rollback/reaplicación y JWT realmente vencido.
- Roadmap: Fase 4
- Dependencias: Fases 1 y 2 completadas; Fase 3 cerrada por decisión del usuario el 2026-10-15 con deuda de verificación explícita; Clerk y el Supabase existentes; aprobación de contratos del Sprint 1.1 antes de mutaciones sociales.
- Criterio de salida: núcleo social funcional con like/unlike, lectura/creación/eliminación propia de comentarios, compartir enlaces y seguir/dejar de seguir usuarios, con permisos equivalentes en UI, servidor y RLS, contadores reales y diseño previo conservado.

**Entrada para otra sesión: «comenzar fase 4».** Leer este documento y
retomar los pendientes de validación del Sprint 1.2; el 1.1 ya está
consolidado. La autorización específica de likes y la evidencia ejecutada
figuran más abajo. No se autorizan por arrastre migraciones de otros
incrementos, commits ni despliegues.

Guion de arranque:

1. Revisar el estado real de Git sin descartar ni sobrescribir cambios.
   La sesión anterior dejó documentación y pruebas sin commit; no asumir
   que el árbol está limpio ni que ese estado seguirá siendo el mismo.
2. Leer el cierre de [Fase 3](fase03.md#puerta-de-fase-4), este plan,
   [roadmap](../inicio/12-roadmap.md), [backlog](../inicio/14-backlog-inicial.md)
   y contratos base afectados.
3. Contrastar esquema/migraciones y superficies actuales antes de añadir
   lógica. En la revisión de planificación no se encontraron tablas ni
   acciones implementadas de likes, comentarios, compartidos o seguimiento.
   Su presencia en el modelo conceptual no prueba que estén implementadas.
4. Respetar los acuerdos de arranque y reanudación de 1.1; resolver solo nuevas decisiones.
   registrar contratos aprobados en documentación base. No inventar acuerdos.
5. Likes (1.2) está implementado: retomar sus pruebas pendientes antes de declararlo cerrado.
   Pedir autorización específica antes de aplicar SQL al remoto; si falta,
   dejar esa parte bloqueada y preparar solo trabajo local autorizado.
6. Usar pruebas enfocadas y avisos breves. Abrir servidor solo si hace falta,
   comprobar que responde y detener todos los procesos propios al terminar.
   No ejecutar regresiones completas repetidamente.

## Objetivo

Permitir que las personas interactúen con publicaciones y autores ya
existentes, sin reconstruir el CRUD ni rediseñar las vistas aprobadas.
Cada incremento debe recorrer contrato → datos/RLS → acción → UI → pruebas
y cerrar con evidencia, antes de sumar el siguiente comportamiento.

Conservar `/inicio` en columna única con carga continua, `/imagenes` y
galerías públicas en grid solo-imágenes, y edición/borrado propios desde
detalle. Las nuevas interacciones se integrarán en feed/detalle y perfiles
según contrato aprobado, no como overlays o textos añadidos al grid.

## Trazabilidad

| Fuente | Elementos cubiertos |
| --- | --- |
| Roadmap | Likes → 1.2; comentarios → 2.1 y 2.2; compartir → 3.1; seguimiento → 4.1; salida núcleo social → 5.1. Contratos y dependencias → 1.1. |
| Backlog | `VIA-015` like/unlike → 1.2; `VIA-016` crear comentario → 2.1; `VIA-017` eliminar comentario propio → 2.2; `VIA-018` compartir → 3.1. Seguimiento y cierre: Sin identificador existente. `VIA-004`/`VIA-005` se reutilizan solo para incrementos de esquema/RLS, sin recrear infraestructura. |
| Requisitos | `RF-10`, `RF-11`, `RF-12`, `RF-13`; `RF-02` para seguidores/seguidos; `RF-03` para presentación de interacciones sin cambiar el orden reciente; `RNF-01` a `RNF-06`. |
| Documentación base | [Alcance](../inicio/02-alcance-y-mvp.md), [arquitectura](../inicio/03-arquitectura.md), [modelo](../inicio/04-modelo-datos.md), [seguridad](../inicio/05-seguridad-y-autorizacion.md), [flujos](../inicio/07-especificacion-funcional.md), [acciones](../inicio/08-api-y-server-actions.md), [UI/UX](../inicio/09-ui-ux.md) y [testing](../inicio/11-testing.md). |
| E2E existentes y nuevos | Conservar E2E-01/02/05/06; implementar E2E-03 (B da like a A), E2E-04 (B comenta A) y nuevos recorridos sin inventar identificadores del catálogo para compartir/seguir. |

## Fuera de alcance

- Rehacer publicaciones, carga/reemplazo de imágenes, autenticación o perfiles.
- Nueva base/proyecto Supabase, reset de datos, cambio de proveedor o credenciales administrativas en el flujo ordinario.
- Comunidades, búsqueda, filtros y navegación por hashtags: Fase 5.
- Rankings, medallas y estadísticas avanzadas: Fase 6.
- Moderación de comentarios ajenos, paneles administrativos y reportes: Fase 7.
- Feed personalizado por seguimiento, popularidad y recomendaciones: Fase 8.
- Notificaciones, chat, respuestas anidadas, edición de comentarios, adjuntos y reacciones distintas del like.
- Métricas de compartidos, tabla/eventos `shares` y analítica, salvo aprobación explícita que actualice el alcance antes de implementarlas.
- Deploy, commit o cambios remotos no autorizados; una validación local no confirma disponibilidad desplegada.

## Riesgos y decisiones

| Tipo | Descripción | Mitigación o decisión requerida |
| --- | --- | --- |
| Dependencia resuelta | El usuario cerró Fase 3 con CRUD aceptado y pruebas ampliadas diferidas. | Conservar [la deuda documentada](fase03.md#pendientes-reales-no-nueva-implementación-del-crud). No marcarla aprobada ni reabrir automáticamente la fase. |
| Restricción aprobada | Se utiliza el mismo Supabase junto a `profiles` y `posts`; se conserva el diseño visual. | Migraciones incrementales y rollback con precondiciones; sin reset, nueva base ni alteración del grid/feed. |
| Decisión aprobada 2026-10-15 | El usuario confirma seguimiento básico en Fase 4: seguir/dejar de seguir y conteos en perfiles. | Sin personalizar el feed ni adelantar recomendaciones; actualizar la distinción MVP/fase en el alcance al consolidar los contratos de 1.1. |
| Decisión aprobada | La API conceptual usaba `toggleLike`/`toggleFollow`. | Estado deseado idempotente y unicidad SQL; resultado autoritativo, última operación confirmada y reconciliación al volver a la pestaña. API base actualizada. |
| Decisión aprobada | Visibilidad de contadores, comentarios y relaciones. | Conteos/comentarios públicos y estado propio privado; mutación con perfil. Sin listas públicas ni apertura de perfiles privados. |
| Decisión aprobada | Longitud, formato y orden de comentarios. | Texto plano de 1–1000 puntos de código tras trim, páginas de 12 recientes con cursor compuesto y UUID de envío idempotente; mismo UUID con otro payload da conflicto. |
| Decisión aprobada | Compartir. | URL del detalle, copia y Web Share opcional; sin métricas. Origen configurado por entorno, localhost solo en desarrollo, nunca firma Storage. |
| Decisión aprobada | Borrado de post con interacciones. | Cascada atómica de likes/comentarios, sin eliminar perfiles, categorías ni alterar el journal de imágenes. |
| Decisión aprobada | Moderación reservada a Fase 7. | Solo autor elimina su comentario en Fase 4, incluso para roles elevados; confirmación y cancelación aprobadas al reanudar. |
| Riesgo | Conteos o estado personal pueden filtrarse/cachéarse entre sesiones o provocar una consulta por tarjeta. | Proyección pública limitada, estado propio separado, lecturas por lote y paginación acotada; medir consultas en 12 tarjetas y tras scroll. No exponer Clerk ID ni filas sociales privadas por defecto. |
| Riesgo | Red interrumpida, sesión vencida y carreras producen dobles envíos o éxito ficticio. | Resultados explícitos, control pendiente, confirmación del servidor, recuperación idempotente y pruebas de fallo real enfocadas sin causar caída global del servicio. |
| Dependencia externa | Clerk/Supabase pueden requerir autenticación administrativa para pruebas/migraciones; no hay deploy nuevo confirmado. | Comprobar acceso sin revelar secretos, registrar bloqueos y no sustituir una prueba remota por mocks. Vercel solo tras autorización. |

Los acuerdos de arranque y reanudación fijan estos contratos; una ampliación
posterior exige decisión explícita y no se infiere del inicio de otro sprint.

## Hito 1 — Contratos claros y primer like persistente

### Sprint 1.1 — Acordar interacción y preparar el primer incremento

**Objetivo:** dejar contratos aprobados y una ruta de implementación sin
reabrir Fase 3 ni modificar datos remotos.

**Alcance**

- [x] Verificación de dependencias y deuda diferida de Fase 3.
- [x] Matriz de permisos y decisiones de UX/datos para las cuatro interacciones.

**Tareas**

- [x] `Sin identificador existente` Contrastar código, esquema e historial real; identificar helpers de sesión, proyección pública, errores y revalidación reutilizables.
- [x] `VIA-015` `VIA-016` `VIA-017` `VIA-018` Resolver las decisiones pendientes de la tabla anterior con el usuario, incluyendo likes sobre post propio y acceso anónimo a compartir.
- [x] `Sin identificador existente` Definir seguimiento sin autosuscripción, destino estable por perfil y comportamiento ante cambio de username; acordar superficies y contadores sin rediseño.
- [x] `VIA-004` `VIA-005` Definir FK, unicidad, índices, grants/RLS, proyección de autor y borrado de interacciones al retirar post; separar permisos ordinarios de moderación futura.
- [x] `Sin identificador existente` Actualizar ERS, alcance, modelo, seguridad, acciones, flujos y UI afectados con acuerdos reales; leer guías locales de Next.js antes de escribir código en sprints posteriores.
- [x] `Sin identificador existente` Precisar autorización necesaria para cada operación remota y estrategia de fixtures/limpieza; no asumirla del texto «comenzar fase 4».

**Criterios de aceptación**

- [x] CA-1.1.1 — Cierre de Fase 3 y deuda están enlazados; no se intenta una instalación limpia ni se modifica el diseño aprobado.
- [x] CA-1.1.2 — Cada interacción tiene entrada, límites, visibilidad, permisos, idempotencia, errores y superficies acordados, sin decisiones bloqueantes ocultas.
- [x] CA-1.1.3 — Roadmap, backlog y documentos base son coherentes; likes es el primer incremento listo para implementar bajo autorización aplicable.

**Pruebas**

- [x] P-1.1.1 — Unitarias: no aplica a este sprint documental; revisar casos exactos previstos para validadores futuros (CA-1.1.2).
- [x] P-1.1.2 — Integración documental: contrastar cierre anterior, modelo aplicado y contratos/CA de esta fase (CA-1.1.1 a CA-1.1.3).
- [x] P-1.1.3 — E2E documental: guion A/B/anónimo en feed, detalle y perfiles, sin afirmar ejecución de UI nueva (CA-1.1.2, CA-1.1.3).
- [x] P-1.1.4 — Seguridad/RLS documental: matriz de lectura y mutación de cada recurso para anónimo, sin perfil, propietario, tercero y roles elevados (CA-1.1.2).

**Evidencia de cierre**

- Pendiente.
- Arranque 2026-10-15: revisados cierre/deuda de Fase 3, roadmap,
  backlog, migraciones y superficies actuales de feed/detalle. Los helpers
  reutilizables incluyen `auth`, `getOwnProfile`, los clientes Supabase
  público/autenticado, errores redactados y `revalidatePath`.
- `node node_modules\supabase\dist\supabase.js migration list --linked`:
  ocho versiones locales coinciden con el historial remoto, hasta
  `20261015192000`. Consulta sin aplicar migraciones; no demuestra por sí
  sola ausencia de cambios manuales de esquema ni valida nueva RLS.
- El usuario aprobó seguimiento básico sin personalización del feed.
  Este sprint no se declara cerrado: falta consolidar los acuerdos siguientes
  en la documentación base y completar la verificación de contratos.

### Acuerdos de arranque y pausa de MCP — 2026-10-15

Las decisiones siguientes fueron aprobadas explícitamente por el usuario;
reemplazan las propuestas pendientes equivalentes de la tabla de riesgos.
No equivalen a implementación ni a pruebas superadas.

- Likes y seguimiento usan estado deseado idempotente, no toggles; el
  servidor confirma el resultado y entre pestañas prevalece la última
  operación confirmada.
- Conteos y comentarios de publicaciones públicas admiten lectura anónima.
  Las mutaciones exigen sesión y perfil; el estado personal solo es visible
  para su titular. No hay listas públicas de likes ni seguidores/seguidos.
- Se permite dar like a publicaciones propias.
- Comentarios: texto plano de 1–1000 puntos de código Unicode después de
  trim, sin interpretar HTML/Markdown; páginas de 12, orden reciente
  descendente y cursor estable. Cada envío usa identificador idempotente.
- Solo el autor de un comentario puede eliminarlo, incluso para roles
  elevados; ser autor del post no permite eliminar comentarios ajenos.
- Compartir admite anónimos, copia de enlace y opción nativa si está
  disponible; sin métricas. URL del detalle con origen configurado de la
  aplicación, nunca firma de imagen; cancelar no equivale a éxito.
- Al borrar un post se eliminan atómicamente sus likes y comentarios por
  cascada, sin eliminar perfiles ni modificar el journal de imágenes.
- Autorización específica: migración incremental de likes en el Supabase
  existente mediante MCP y pruebas con fixtures temporales y limpieza.
  No incluye reset, datos reales, commits, despliegue ni migraciones de
  comentarios/seguimiento. No se autorizó sustituir MCP por CLI para aplicarla.
- El usuario pidió pausar la fase para reparar primero MCP. La llamada
  inicial exigía autenticación; tras reiniciar desde VS Code, el log local
  registró servidor en ejecución y 29 herramientas descubiertas. La
  conversación aún no pudo validar una consulta: la búsqueda de herramientas
  informó que no había un cliente conectado.
- Diagnóstico posterior: la configuración MCP del espacio de trabajo se
  había vaciado y se restauró desde Git. VS Code autentica por OAuth, pero el
  agent host de Copilot que lee `.mcp.json` recibe el 401 de OAuth y no
  completa el flujo. Se probó una cabecera `Authorization` con token de
  entorno, pero el agente siguió pidiendo OAuth. El 2026-10-15 se retiró
  esa cabecera de `.mcp.json`: la conexión queda solo con OAuth mediante
  `/mcp auth supabase`. La API de gestión respondió a una consulta de
  solo lectura (proyecto `ACTIVE_HEALTHY`, ocho migraciones), lo que no
  equivale a una consulta MCP superada.
- Reanudación: comprobar primero una consulta MCP de solo lectura,
  consolidar estos contratos en documentos base y continuar likes.
  No se escribió ni aplicó SQL social ni se implementó UI de likes.

### Reanudación y cierre de contratos — 2026-10-15

- MCP recuperado: consulta real de ocho migraciones y contraste de tablas,
  funciones y políticas de publicaciones. No existían tablas sociales.
- El usuario aprobó confirmar/cancelar el borrado del comentario y origen
  de compartir configurado por entorno, con localhost solo en desarrollo.
- Acuerdos consolidados en ERS, alcance, modelo, seguridad, acciones,
  flujos y UI/UX; seguimiento básico está en Fase 4 sin personalizar feed.
- Reutilizados `auth`, `getOwnProfile`, clientes público/autenticado y
  contexto de error redactado. Leídas guías locales de `use server` y
  Server Actions. No se reabre Fase 3 ni se altera el grid aprobado.
- Guion de validación: A publica; B da/quita like y comenta; anónimo lee
  conteos/comentarios y comparte sin mutar; sin perfil no muta; roles
  elevados no actúan sobre relaciones ajenas. Seguir exige destino distinto
  del actor; cambios de username no cambian la relación por ID.
- Se mantiene autorización solo para migración de likes mediante MCP,
  fixtures temporales y limpieza. Comentarios/seguimiento requieren su
  propia autorización remota. Sin reset, commit ni despliegue.

### Sprint 1.2 — Like/unlike con estado y conteo reales

**Objetivo:** B puede dar/quitar un like a una publicación de A y comprobar
persistencia sin duplicados.

**Alcance**

- [x] Incremento vertical de `likes`, acción y UI en feed/detalle.
- [x] Lectura por lotes de conteos/estado propio sin modificar la galería.

**Tareas**

- [x] `VIA-015` `VIA-004` `VIA-005` Migración con referencias a post/perfil existentes, unicidad por pareja, índices y RLS de identidad derivada; versionar rollback protegido ante datos.
- [x] `VIA-015` Implementar contrato aprobado de estado deseado y resultado autoritativo; repetir solicitud no duplica ni invierte estado, unlike ajeno no se permite.
- [x] `VIA-015` Añadir control accesible con estado presionado, pendiente y error recuperable; revalidar feed/detalle y nuevas tarjetas cargadas al bajar, sin éxito optimista definitivo no confirmado.
- [x] `VIA-015` Consultar agregados/estado en lotes acotados, sin exponer identidad Clerk o dar lectura general de `profiles`/likes privados.
- [x] `VIA-015` Probar retirada de post con likes conservando el protocolo de limpieza de imagen; registrar errores técnicos redactados.

**Criterios de aceptación**

- [x] CA-1.2.1 — Like y unlike persisten tras recarga en feed/detalle; dos peticiones iguales y concurrencia no crean dos likes ni conteos negativos.
- [ ] CA-1.2.2 — Anónimo/sesión vencida/sin perfil no mutan; B no elige autor ni elimina like ajeno; post inexistente/retirado no recibe likes.
- [x] CA-1.2.3 — Fallo de servidor se muestra y conserva estado recuperable; las tarjetas cargadas por scroll y el teclado muestran estado real sin filtración entre sesiones.
- [ ] CA-1.2.4 — Migración/rollback y retiro del post preservan perfiles, publicaciones ajenas y limpieza Storage previa.

**Pruebas**

- [x] P-1.2.1 — Unitarias: IDs/estado, respuesta repetida, error, sesión y resultados autoritativos (CA-1.2.1 a CA-1.2.3).
- [ ] P-1.2.2 — Integración: unicidad/carreras, conteos por lote, borrar post, rollback/reaplicación transaccional cuando sea seguro y fixtures sin residuos (CA-1.2.1, CA-1.2.4).
- [x] P-1.2.3 — E2E-03: B da/quita like a A, recarga, feed→detalle, lote añadido por scroll, teclado y 360/768/1280; fallo de petición con UI honesta (CA-1.2.1, CA-1.2.3).
- [ ] P-1.2.4 — Seguridad/RLS: A/B/anónimo, sin perfil, JWT inválido/vencido, payload con propietario alterado y roles elevados sin privilegio ajeno (CA-1.2.2, CA-1.2.4).

**Evidencia de cierre**

- Migración `20261015223045_add_post_likes` aplicada mediante Supabase MCP
  al proyecto existente y confirmada en su historial. Tabla `likes`,
  unicidad, índice por actor, RLS forzada, grants por columna y RPCs con
  proyección acotada/estado deseado; sin credenciales administrativas en app.
- Acción `setPostLike`, lectura `loadPostLikes` y control en feed/detalle.
  Lotes de 12, solo nuevos IDs al añadir tarjetas, descarte de respuestas
  de otra sesión/anteriores a una mutación y reconciliación al recuperar foco.
  Galerías sin controles ni cambios de diseño.
- 55 pruebas Vitest aprobadas en cinco archivos: likes (acciones/control),
  presentación de posts, lectura pública y gestión previa de publicaciones.
  `npm run typecheck`, lint enfocado, `npm run build` y
  `npm run test:client-secrets` aprobados.
- SQL real por MCP: A/B/anónimo/sin perfil/moderador/admin, like propio,
  reintentos, unlike ajeno, suplantación, límites de lote, grants y cascada
  con journal conservado. Fixtures SQL deshechos mediante rollback.
- `npm run test:e2e -- post-likes`: Chromium aprobado con imágenes reales,
  ocho likes iguales concurrentes, persistencia/recarga, teclado y tres
  anchos, fallo antes del envío y respuesta perdida tras ejecutar el cambio.
  El reintento confirma el mismo estado. Conteos anónimos, cambio B→anónimo→A,
  auto-like, retiro del post y limpieza física comprobados.
- Medición en navegador: una petición de likes para las primeras 12
  tarjetas; una segunda petición, de hasta 12 IDs exclusivamente nuevos,
  al cargar el siguiente lote. No hay una consulta social por tarjeta.
- La prueba real de API incluye JWT malformado, no JWT realmente vencido.
  Los avisos de desarrollo Clerk/Realtime y streams cancelados al cambiar
  sesión se registran sin considerarlos prueba de expiración.
- Pendientes para cierre completo: ensayo transaccional de rollback y
  reaplicación del esquema (el rollback está versionado y exige tabla vacía)
  y frontera con JWT realmente vencido. Por ello CA-1.2.2/4 y P-1.2.2/4
  conservan casillas abiertas aunque sus demás casos estén comprobados.
- Sin reset, nueva base, commit ni despliegue. No se implementaron todavía
  comentarios, compartir ni seguimiento.
- Consulta MCP final: cero likes y cero perfiles/posts/tickets de los
  fixtures de esta sesión. Usuarios Clerk eliminados por el `finally` del
  E2E y servidor Playwright detenido; no quedan recursos de prueba conocidos.

## Hito 2 — Conversación persistente y administrable por su autor

### Sprint 2.1 — Leer y crear comentarios

**Objetivo:** B comenta un post de A y el texto aparece con autor público
seguro y lectura paginada.

**Alcance**

- [ ] Esquema/RLS, consulta y formulario de comentarios en detalle.
- [ ] Conteo/enlace a comentarios desde feed, sin formularios dentro del grid.

**Tareas**

- [ ] `VIA-016` `VIA-004` `VIA-005` Migrar comentarios según límites y FK aprobados en 1.1, autor derivado, campos protegidos, índices y rollback no destructivo con datos.
- [ ] `VIA-016` Validar texto también en PostgreSQL; representar como texto seguro, sin ejecutar HTML ni aceptar autor/timestamps del formulario.
- [ ] `VIA-016` Resolver doble envío/respuesta perdida con el contrato aprobado; conservar borrador al fallar, distinguir vacío de fallo de lectura y anunciar resultado.
- [ ] `VIA-016` Paginar por cursor estable incluyendo empates; actualizar conteo, detalle y feed sin descargar todos los comentarios ni identidades privadas.

**Criterios de aceptación**

- [ ] CA-2.1.1 — Comentario válido persiste una sola vez según el contrato de reintento; autor y conteo correctos tras recarga.
- [ ] CA-2.1.2 — Vacío/solo espacios, exceso de longitud, post retirado y suplantación se rechazan sin filas parciales; texto con etiquetas se muestra inerte.
- [ ] CA-2.1.3 — Varias páginas con fechas iguales no omiten/duplican comentarios; servicio fallido no parece lista vacía; autor público no expone identidad privada.
- [ ] CA-2.1.4 — Formulario usa labels, foco/errores y estado pendiente; anónimo lee según contrato, pero sesión vencida o perfil ausente no permiten enviar.

**Pruebas**

- [ ] P-2.1.1 — Unitarias: límites L-1/L/L+1, trim/Unicode, IDs, idempotencia y estados de error (CA-2.1.1, CA-2.1.2).
- [ ] P-2.1.2 — Integración: SQL directo, creación repetida, FK, proyección, contador, cursor con empates y rollback/reaplicación seguro (CA-2.1.1 a CA-2.1.3).
- [ ] P-2.1.3 — E2E-04: B comenta A, recarga, verifica autor/conteo, corrige inválidos, pagina, conserva borrador con fallo y usa teclado a 360/768/1280 (CA-2.1.1 a CA-2.1.4).
- [ ] P-2.1.4 — Seguridad/RLS: A/B/anónimo/sin perfil/sesión vencida, autor falso y HTML como texto; no lectura de columnas privadas (CA-2.1.2 a CA-2.1.4).

**Evidencia de cierre**

- Pendiente.

### Sprint 2.2 — Eliminar solo comentarios propios

**Objetivo:** el autor retira su comentario con conteos coherentes sin
conceder moderación anticipada.

**Alcance**

- [ ] Acción, RLS y control accesible de eliminación propia.
- [ ] Compatibilidad del borrado de posts con comentarios/likes.

**Tareas**

- [ ] `VIA-017` Implementar retirada idempotente según propiedad, sin confiar en controles ocultos ni propietario enviado por cliente.
- [ ] `VIA-017` Aplicar confirmación/cancelación acordadas en 1.1, estado pendiente, error recuperable y foco; no añadir edición de comentarios.
- [ ] `VIA-017` Revalidar lista/conteos y resolver retirada del último elemento de una página sin omisiones ni total ficticio.
- [ ] `VIA-017` Verificar borrado del post con hijos sociales y journal Storage existente; no bloquear el CRUD previo con FK incompatibles.

**Criterios de aceptación**

- [ ] CA-2.2.1 — Eliminar el comentario propio lo retira y actualiza conteos; cancelar conserva datos y repetir no afecta otro comentario.
- [ ] CA-2.2.2 — Terceros, autor del post y roles elevados no borran comentarios ajenos por URL, acción ni SQL ordinario.
- [ ] CA-2.2.3 — Fallos muestran error sin desaparición ficticia; retirar un post elimina sus hijos según contrato y mantiene la limpieza de imagen.

**Pruebas**

- [ ] P-2.2.1 — Unitarias: ID/propiedad, repetición, error y revalidación (CA-2.2.1 a CA-2.2.3).
- [ ] P-2.2.2 — Integración: retiro propio/ajeno, conteos, última página, borrado del post y conservación de recursos ajenos (CA-2.2.1 a CA-2.2.3).
- [ ] P-2.2.3 — E2E: cancelar/confirmar con teclado, recargar y comprobar contador, B no ve control ajeno y error de red no aparenta éxito; tres anchos (CA-2.2.1 a CA-2.2.3).
- [ ] P-2.2.4 — Seguridad/RLS: comentario A como B, propietario del post, anónimo y moderador/admin; manipular autor/ID y usar sesión vencida (CA-2.2.2).

**Evidencia de cierre**

- Pendiente.

## Hito 3 — Compartir el recurso correcto con resultado honesto

### Sprint 3.1 — Copiar y compartir enlace público

**Objetivo:** compartir el detalle público, nunca una firma temporal ni una
referencia privada de Storage.

**Alcance**

- [ ] Acción de compartir en feed/detalle, con copia y alternativa aprobadas.
- [ ] Sin métricas, eventos remotos ni tabla `shares` por defecto.

**Tareas**

- [ ] `VIA-018` Construir URL canónica de `/post/[id]` según origen permitido aprobado, sin parámetros privados o URL firmada.
- [ ] `VIA-018` Implementar Clipboard/Web Share según capacidades y contrato; cancelación no es éxito, fallo de copia tiene mensaje/alternativa accesible, sin dependencias innecesarias.
- [ ] `VIA-018` Conservar foco y anunciar únicamente resultado real; no cambiar diseño del feed ni añadir controles al grid.

**Criterios de aceptación**

- [ ] CA-3.1.1 — Enlace compartido abre el mismo detalle como anónimo mientras existe; tras retirarlo no muestra contenido anterior.
- [ ] CA-3.1.2 — API ausente, permiso denegado y cancelación tienen resultados distintos; no se informa «copiado» si no se copió.
- [ ] CA-3.1.3 — El payload no contiene JWT, firma de imagen, identidad Clerk ni origen arbitrario; control funciona con teclado y tres anchos.

**Pruebas**

- [ ] P-3.1.1 — Unitarias: construcción/validación de URL, APIs ausentes, rechazo/cancelación y resultado (CA-3.1.1 a CA-3.1.3).
- [ ] P-3.1.2 — Integración: capacidades del navegador y navegación al detalle/404; sin esquema ni rollback nuevos si no se persisten eventos (CA-3.1.1, CA-3.1.2).
- [ ] P-3.1.3 — E2E: copiar y abrir en contexto anónimo; Clipboard denegado y Web Share simulado se identifican como simulados; teclado y 360/768/1280 (CA-3.1.1 a CA-3.1.3).
- [ ] P-3.1.4 — Seguridad/RLS: inspeccionar URL/payload y acceso a post retirado; no aplica nueva RLS sin persistencia, se conserva la de publicaciones (CA-3.1.1, CA-3.1.3).

**Evidencia de cierre**

- Pendiente.

## Hito 4 — Seguir autores sin modificar el feed aprobado

### Sprint 4.1 — Seguir/dejar de seguir y conteos de perfil

**Objetivo:** B sigue/deja de seguir a A con estado persistente y relaciones
seguras, sin feed personalizado.

**Alcance**

- [ ] `follows`, mutación propia y control en perfil público ajeno.
- [ ] Conteos reales de seguidores/seguidos en perfiles según contrato.

**Tareas**

- [ ] `Sin identificador existente` `VIA-004` `VIA-005` Migrar relaciones con FK a perfiles, unicidad, prohibición de auto-seguimiento, índices, RLS y rollback protegido.
- [ ] `Sin identificador existente` Implementar estado deseado idempotente, resolviendo actor autenticado y destino estable sin confiar en Clerk ID/rol enviados.
- [ ] `Sin identificador existente` Integrar botón/estado/conteos según acuerdos; sin botón activo para seguirse a sí mismo ni cambios del orden del feed.
- [ ] `Sin identificador existente` Resolver username renombrado, perfil inexistente, sesión vencida, carreras y fallo de red; revalidar ambos perfiles sin divulgar datos privados.

**Criterios de aceptación**

- [ ] CA-4.1.1 — Seguir/repetir/dejar de seguir persiste sin duplicados, con conteos exactos en ambos perfiles tras recarga.
- [ ] CA-4.1.2 — Auto-seguimiento, destino inexistente y mutación ajena no son posibles ni mediante acceso directo.
- [ ] CA-4.1.3 — Renombrar username no rompe relaciones; error o sesión vencida no producen éxito ficticio ni exponen estado de otro visitante.
- [ ] CA-4.1.4 — Teclado/responsive y navegación de perfil se conservan; feed reciente y galerías mantienen comportamiento/diseño previos.

**Pruebas**

- [ ] P-4.1.1 — Unitarias: destino/estado, repetición, mensajes y revalidación (CA-4.1.1 a CA-4.1.3).
- [ ] P-4.1.2 — Integración: unicidad, auto-follow, carreras, renombrado, conteos y rollback/reaplicación sin afectar perfiles (CA-4.1.1 a CA-4.1.3).
- [ ] P-4.1.3 — E2E: B sigue A, recarga, visita ambos perfiles y deja de seguir; sin control propio, fallo observable y teclado a 360/768/1280 (CA-4.1.1 a CA-4.1.4).
- [ ] P-4.1.4 — Seguridad/RLS: anónimo/sin perfil/A/B/roles elevados, follower falsificado y JWT inválido/vencido; proyección solo con datos autorizados (CA-4.1.2, CA-4.1.3).

**Evidencia de cierre**

- Pendiente.

## Hito 5 — Núcleo social demostrado y siguiente fase delimitada

### Sprint 5.1 — Cierre enfocado de interacción

**Objetivo:** comprobar las cuatro interacciones en conjunto y conservar
publicaciones, perfiles y límites de seguridad existentes.

**Alcance**

- [ ] Recorrido integrado A/B/anónimo y regresión de superficies afectadas.
- [ ] Evidencia reproducible, limpieza de fixtures y documentación de salida.

**Tareas**

- [ ] `VIA-015` `VIA-016` `VIA-017` `VIA-018` `Sin identificador existente` Recorrer like, comentario, retiro propio, compartir y seguir con recarga y cambios de sesión.
- [ ] `Sin identificador existente` Ejecutar unitarias relacionadas, tipos/lint, build/escaneo al cierre del incremento pertinente y matrices SQL/HTTP afectadas; no repetir suites completas sin causa.
- [ ] `Sin identificador existente` Verificar migraciones y rollback incremental de lo nuevo con precondiciones/respaldo; usar transacciones revertidas o entorno ya autorizado, nunca reset del compartido ni otra base por iniciativa propia.
- [ ] `Sin identificador existente` Ejecutar comprobaciones enfocadas de deuda de Fase 3 solo cuando el cambio toque esa superficie; distinguir nuevos resultados de diferimientos todavía vigentes.
- [ ] `Sin identificador existente` Verificar cero fixtures propios en Clerk/PostgreSQL/Storage, conservar datos reales y detener procesos abiertos; registrar comandos y resultados sin secretos.
- [ ] `Sin identificador existente` Actualizar docs con decisiones/evidencia y destino de Fase 5; despliegue/commit únicamente con autorización independiente.

**Criterios de aceptación**

- [ ] CA-5.1.1 — Likes, comentarios, compartir y seguimiento funcionan de extremo a extremo con estado y permisos equivalentes en UI, acciones y base.
- [ ] CA-5.1.2 — CRUD de posts, perfiles, avatar, acceso y logout conservan comportamiento; feed continuo y grid aprobado no regresan.
- [ ] CA-5.1.3 — Esquema incremental/RLS/rollback comprobados, sin fixtures ni procesos propios residuales; no se confunden resultados simulados con pruebas remotas.
- [ ] CA-5.1.4 — Evidencia accesible/responsive y comandos respaldan cierre; pendientes explícitos y alcance de Fase 5 documentados, sin afirmar deploy no realizado.

**Pruebas**

- [ ] P-5.1.1 — Unitarias: suites sociales y de posts/perfiles afectadas, errores y límites exactos aprobados (CA-5.1.1, CA-5.1.2).
- [ ] P-5.1.2 — Integración: auth-boundary, RLS, conteos/paginación, retirada del post con hijos y cleanup de imagen; historial/rollback de lo nuevo y cero fixtures (CA-5.1.1 a CA-5.1.3).
- [ ] P-5.1.3 — E2E: E2E-03/04 más compartir/seguir, edición/borrado de post con interacción, perfil/avatar y sesión expirada donde haya impacto; teclado, foco, contraste y 360/768/1280 (CA-5.1.1, CA-5.1.2, CA-5.1.4).
- [ ] P-5.1.4 — Seguridad/RLS: matriz A/B/anónimo/sin perfil/roles, payload manipulado, publicación retirada y aislamiento de caché de estado personal; logs/bundle sin secretos (CA-5.1.1, CA-5.1.3).
- [ ] P-5.1.5 — Verificación documental: roadmap completo, CA→P de todos los sprints, decisiones aprobadas y deuda heredada diferenciada (CA-5.1.4).

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
- [ ] Diseño aprobado conservado y cero controles ficticios en galerías/feed.
- [ ] Deuda heredada de Fase 3 no presentada como prueba aprobada.
- [ ] Cero fixtures y procesos propios residuales; commit/deploy solo con autorización.

## Registro de progreso

| Fecha | Sprint | Estado | Evidencia | Notas |
| --- | --- | --- | --- | --- |
| 2026-10-15 | 1.1 | Pendiente | — | Primer paso al decir «comenzar fase 4»; resolver contratos, sin implementación ni operación remota automática. |
| 2026-10-15 | 1.2 | Pendiente | — | Depende de 1.1; primer incremento implementable: like/unlike. |
| 2026-10-15 | 2.1 | Pendiente | — | Depende de 1.1 y 1.2 para reutilizar permisos/agregados y demostrar el siguiente incremento. |
| 2026-10-15 | 2.2 | Pendiente | — | Depende de 2.1; eliminación propia, no moderación ajena. |
| 2026-10-15 | 3.1 | Pendiente | — | Depende del contrato 1.1; independiente del esquema de comentarios/seguimiento. |
| 2026-10-15 | 4.1 | Pendiente | — | Depende de 1.1 y patrones de identidad/estado de 1.2; no personaliza feed. |
| 2026-10-15 | 5.1 | Pendiente | — | Depende de todos los incrementos anteriores; cierre con evidencia, no por casillas automáticas. |
