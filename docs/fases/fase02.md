# VIA — Fase 02: Usuarios

## Estado

- Estado: En curso
- Roadmap: Fase 2
- Dependencias: Fase 1 completada; autenticación de Clerk y conexión autenticada a Supabase operativas; tabla `profiles` y RLS iniciales aplicadas; proyecto de Supabase Storage disponible; decisión temporal de usar la instancia Clerk Development fuera de datos reales hasta disponer de dominio propio.
- Criterio de salida: sistema de usuarios funcional con perfil persistente asociado a Clerk, username único, avatar, edición propia, rol protegido y rutas públicas/privadas autorizadas correctamente.

## Objetivo

Convertir la bienvenida provisional de Fase 1 en un sistema de usuarios funcional. Una persona autenticada podrá completar y consultar su perfil de VIA, editar sus datos permitidos, publicar un avatar y visitar perfiles públicos por username. Clerk seguirá siendo la fuente de identidad y Supabase la fuente de datos y archivos.

La fase no habilitará gestión administrativa de roles ni las funcionalidades sociales que consumen perfiles. Publicaciones, seguidores, medallas y estadísticas se incorporarán en sus fases correspondientes; la interfaz de perfil no inventará contadores ni contenido inexistente.

## Trazabilidad

| Fuente | Elementos cubiertos |
| --- | --- |
| Roadmap | Perfil, avatar, username, roles y protección de rutas; salida “sistema de usuarios funcional”. |
| Backlog | `VIA-006`, `VIA-007`, `VIA-008`. |
| Requisitos | `RF-02`; ERS 3 (Usuario) y 6 (roles); `RNF-01`, `RNF-02`, `RNF-04`, `RNF-05`, `RNF-06`; Alcance MVP 2 (Perfil y Roles); Modelo de datos 3; Seguridad 2 a 8; Estructura Next.js 2, 4 y 5; Especificación funcional 8; API y Server Actions 2, 3 y 5; UI/UX 6 y 7; Testing 2, 3, 5 y 6. |

## Fuera de alcance

- Crear, listar o administrar publicaciones; corresponde a Fase 3.
- Implementar follows, likes, comentarios o compartir; corresponde a Fase 4.
- Mostrar medallas, rankings o estadísticas reales; corresponde a Fase 6.
- Crear la interfaz administrativa para asignar o revocar roles; corresponde a Fase 7. Esta fase sí versiona la jerarquía RLS, protege los cambios de rol y realiza el bootstrap auditado del primer `admin`.
- Crear paneles administrativos o rutas `/admin`.
- Sincronizar toda la identidad mediante webhooks de Clerk. Se evaluará aparte cuando exista un evento externo que deba reflejarse sin una sesión activa.
- Configurar Clerk Production, dominio propio o Google OAuth de producción; sigue diferido hasta disponer del dominio.

## Riesgos y decisiones

| Tipo | Descripción | Mitigación o decisión requerida |
| --- | --- | --- |
| Decisión | Un usuario autenticado sin fila en `profiles` necesita completar datos propios antes de tener perfil funcional. | Redirigir a `/perfil/completar`, precargar solo datos seguros de Clerk y crear la fila mediante una Server Action idempotente; no mutar datos durante el renderizado. |
| Decisión | El contrato exacto de username no está definido en Fase 0. | Adoptar username canónico en minúsculas, de 3 a 30 caracteres ASCII, compuesto por letras, números y guion bajo; aplicar la misma regla en validador, migración y mensajes. Documentar cualquier cambio antes de implementarlo. |
| Decisión | La jerarquía de perfiles debe aplicarse antes de crear el panel de administración. | `user` edita solo sus campos propios; `moderator` gestiona campos y eliminación solo de perfiles `user`; `admin` gestiona todos los perfiles y roles. ID e identidad Clerk son inmutables y el último admin no puede eliminarse ni degradarse. La UI administrativa permanece en Fase 7. |
| Riesgo | La unicidad de username puede sufrir carreras entre validación e inserción/edición. | Tratar la restricción única de PostgreSQL como autoridad y convertir su error en un resultado controlado sin detalles internos. |
| Riesgo | Un perfil público podría exponer `clerk_user_id` u otros campos internos. | Diseñar una proyección pública explícita con columnas permitidas; probar el acceso directo como anónimo y autenticado. |
| Riesgo | Un archivo con MIME declarado falso, tamaño excesivo o ruta ajena podría entrar en Storage. | Validar en servidor contenido, tipo y tamaño; usar rutas propiedad del `sub` autenticado y políticas de Storage de mínimo privilegio. |
| Riesgo | Reemplazar o eliminar un avatar puede dejar objetos huérfanos o una URL inconsistente. | Ordenar las operaciones, usar nombres no reutilizados, actualizar la referencia de forma controlada y limpiar el objeto anterior con recuperación ante fallo parcial. |
| Dependencia externa | Supabase Storage debe estar disponible y sus políticas deben reconocer el `sub` de Clerk. | Versionar bucket y políticas mediante migración, probarlas directamente y preparar rollback sin depender del panel. |

## Hito 1 — Perfil persistente identificable

### Sprint 1.1 — Alta de perfil asociada a Clerk

**Objetivo:** permitir que una sesión autenticada sin perfil complete un username y cree exactamente una fila propia con rol `user`.

**Alcance**

- [x] Contrato de campos de perfil y username aplicado en TypeScript y PostgreSQL.
- [x] Flujo privado `/perfil/completar` para crear el perfil persistente.
- [x] Migración incremental, RLS y rollback para el alta propia.
- [x] Jerarquía RLS para `user`, `moderator` y `admin`, con primer administrador auditado.

**Tareas**

- [x] `VIA-006` Definir un esquema compartido de validación para username, nombre visible y biografía, con normalización determinista y mensajes accesibles.
- [x] `VIA-006` Crear una migración que consolide restricciones de `profiles`, mantenga `role = 'user'` por defecto y preserve compatibilidad con el esquema de Fase 1.
- [x] `VIA-006` Implementar una Server Action idempotente de alta que valide entrada, sesión, ausencia de perfil, identidad Clerk y conflicto de username antes de insertar.
- [x] `VIA-006` Crear `/perfil/completar` como formulario accesible, precargado con identidad segura de Clerk y con estados pendiente, éxito, datos inválidos, conflicto y error temporal.
- [x] `VIA-006` Hacer que `/perfil` dirija al alta cuando no exista fila y muestre el perfil cuando exista, sin insertar durante el renderizado.
- [x] `Sin identificador existente` Versionar y ensayar rollback de las restricciones y políticas añadidas.
- [x] `Sin identificador existente` Versionar funciones, trigger, privilegios y políticas RLS de la matriz jerárquica de perfiles.
- [x] `Sin identificador existente` Asignar mediante SQL auditado el primer rol `admin` al único perfil existente, sin versionar su identidad.

**Criterios de aceptación**

- [x] CA-1.1.1 — Una sesión válida sin perfil completa datos válidos y obtiene una única fila vinculada a su `sub`, con username canónico único y rol `user`.
- [x] CA-1.1.2 — Username vacío, mal formado, demasiado corto/largo o ya ocupado no crea ni modifica filas y produce un mensaje comprensible.
- [x] CA-1.1.3 — Una petición anónima, con identidad ajena o que intenta asignar otro rol no puede crear un perfil.
- [x] CA-1.1.4 — Repetir el alta o reenviar el formulario no duplica el perfil ni expone errores internos.
- [x] CA-1.1.5 — La migración se aplica y revierte de forma reproducible sin debilitar las garantías de Fase 1.
- [x] CA-1.1.6 — `user` solo modifica sus campos propios; `moderator` gestiona únicamente perfiles `user`; `admin` gestiona perfiles y roles de todos.
- [x] CA-1.1.7 — Ningún rol modifica `id` o `clerk_user_id`, y el último `admin` no puede degradarse ni eliminarse.

**Pruebas**

- [x] P-1.1.1 — Unitarias: validar normalización y límites de username, nombre y biografía, incluidos Unicode permitido en texto visible y caracteres inválidos en username (CA-1.1.1, CA-1.1.2).
- [x] P-1.1.2 — Integración: ejecutar la Server Action con alta válida, duplicada, username ocupado, datos inválidos, sesión ausente y fallo temporal de Supabase (CA-1.1.1 a CA-1.1.4).
- [x] P-1.1.3 — E2E: iniciar sesión sin perfil, llegar a `/perfil/completar`, corregir un error, completar el alta y terminar en `/perfil` (CA-1.1.1, CA-1.1.2).
- [x] P-1.1.4 — Seguridad/RLS: probar directamente alta propia, identidad ajena, segundo perfil, rol privilegiado y claims ausentes o malformados (CA-1.1.3, CA-1.1.4).
- [x] P-1.1.5 — Migración/rollback: aplicar, inspeccionar restricciones y políticas, revertir y reaplicar comparando el catálogo resultante (CA-1.1.5).
- [x] P-1.1.6 — Seguridad/RLS: ejecutar la matriz directa como `user`, `moderator` y `admin`, incluidos objetivos de cada rol, cambio de rol, identidad inmutable, eliminación y protección del último admin (CA-1.1.6, CA-1.1.7).

**Evidencia de cierre**

- 2026-10-01: Zod incorporado como dependencia directa; 27 pruebas unitarias e integración validaron normalización, límites, Unicode visible, datos inválidos, alta propia, sesión ausente, idempotencia, conflicto de username, fallo de datos y redacción de logs.
- 2026-10-01: migración `20261001000100_enforce_profile_contract.sql` aplicada al remoto tras confirmar cero perfiles incompatibles; historial local/remoto sincronizado.
- 2026-10-01: RLS remota y rollback/reaplicación de todas las migraciones superados en transacciones reversibles; username inválido, bio excesiva, identidad ajena y elevación de rol fueron rechazados.
- 2026-10-01: integración HTTP con sesión Clerk aislada confirmó 307 de `/perfil` a `/perfil/completar`, formulario autenticado HTTP 200 y rechazo de token expirado; build y escaneo de secretos superados.
- 2026-10-01: migración `20261001000200_add_profile_role_policies.sql` aplicada al remoto; matriz RLS directa superada para lectura, edición, eliminación, roles superiores, cambio de rol, identidad inmutable y último admin. Rollback/reaplicación conservó el catálogo exacto.
- 2026-10-01: `admin_via` promovido de `user` a primer `admin` mediante transacción administrativa con cero admins como precondición y exactamente un admin como postcondición; la identidad no se incluyó en la migración.
- 2026-10-01: E2E Playwright con usuario Clerk efímero superado en Chromium: sesión sin perfil, redirección a `/perfil/completar`, rechazo accesible de username inválido, corrección, creación con rol `user`, llegada a `/perfil` y limpieza final en Supabase y Clerk.
- 2026-10-01: regresión final superada con 27 pruebas Vitest, TypeScript estricto, ESLint, build de producción y E2E; `@clerk/testing` 2.2.39 y `@playwright/test` 1.63.0 quedaron resueltos sin duplicados, y Clerk y Supabase terminaron con cero fixtures E2E.
- Sprint 1.1 completado; Sprint 1.2 desbloqueado.

### Sprint 1.2 — Perfil propio y perfil público seguro

**Objetivo:** mostrar el perfil persistente propio y permitir consultar por username una proyección pública sin campos internos.

**Alcance**

- [x] `/perfil` convertido en vista persistente del usuario autenticado.
- [x] `/usuario/[username]` disponible como perfil público.
- [x] Proyección pública y permisos de lectura mínimos versionados.

**Tareas**

- [x] `VIA-006` Centralizar consultas de perfil propio y público en `lib/`, con tipos separados que impidan mezclar campos internos y públicos.
- [x] `VIA-006` Crear una proyección pública de solo username, nombre visible, biografía, avatar y rol, sin exponer `clerk_user_id`.
- [x] `VIA-006` Implementar `/perfil` y `/usuario/[username]` como Server Components con estados de carga, perfil inexistente y servicio no disponible.
- [x] `VIA-006` Representar publicaciones, seguidores, seguidos y medallas como secciones no activas o estados vacíos honestos, sin consultas ni métricas ficticias.
- [x] `Sin identificador existente` Diseñar ambas vistas para teclado, lector de pantalla, móvil, tablet y escritorio.

**Criterios de aceptación**

- [x] CA-1.2.1 — El propietario ve sus datos persistentes correctos en `/perfil` y un visitante ve solo campos públicos en `/usuario/[username]`.
- [x] CA-1.2.2 — Un username inexistente o no canónico devuelve un estado controlado y no filtra si existe un `clerk_user_id` concreto.
- [x] CA-1.2.3 — Ninguna consulta pública, respuesta o bundle cliente contiene identificadores Clerk, secretos o campos no permitidos.
- [x] CA-1.2.4 — Las vistas son semánticas, navegables por teclado y no presentan solapamientos en móvil ni escritorio.

**Pruebas**

- [x] P-1.2.1 — Unitarias: probar el mapeo de fila interna a perfil público y la exclusión estructural de campos internos (CA-1.2.1, CA-1.2.3).
- [x] P-1.2.2 — Integración: consultar perfil propio, perfil público existente, username inexistente y fallo de datos, verificando resultados controlados (CA-1.2.1, CA-1.2.2).
- [x] P-1.2.3 — E2E: visitar perfil propio autenticado y perfil público como visitante, incluidos estado inexistente y navegación responsive (CA-1.2.1, CA-1.2.2, CA-1.2.4).
- [x] P-1.2.4 — Seguridad/RLS: consultar directamente la proyección pública como anónimo y autenticado, y confirmar que la tabla base y `clerk_user_id` no quedan expuestos (CA-1.2.3).
- [x] P-1.2.5 — Accesibilidad/responsive: comprobar jerarquía, texto alternativo del avatar, foco, contraste, zoom y vistas móvil/escritorio (CA-1.2.4).

**Evidencia de cierre**

- 2026-10-14: Supabase MCP autenticado comprobado mediante consultas de migraciones y políticas; migración [add_public_profile_lookup](../../supabase/migrations/20261014173824_add_public_profile_lookup.sql) aplicada y numeración local alineada con el historial remoto.
- Proyección implementada como RPC SQL `get_public_profile(text)`, `security definer` con `search_path` vacío, sin SQL dinámico ni privilegios nuevos sobre `profiles`. Solo devuelve los cinco campos aprobados y admite un username canónico exacto. El cliente público no obtiene tokens Clerk.
- Consultas propias filtradas por la identidad autenticada, tipos privados/públicos separados y validación de respuestas; estados de carga, 404 público, redirección al alta y errores temporales diferenciados. Logs sin mensajes internos, identidades ni URLs de avatar.
- Pruebas unitarias/de integración cubren mapeo, identidad, límites de username, configuración, fallo de datos, rol desconocido, estados de ruta y referencias de avatar. E2E Chromium comprueba alta, persistencia tras recarga, navegación por teclado, visitante sin sesión, ausencia de identidad/email en HTML público y rechazo de acceso privado anónimo.
- [Prueba SQL](../../supabase/tests/public_profiles_rls.sql) superada contra el remoto: lectura anónima/autenticada de exactamente cinco columnas, rechazo de lectura/escritura privada anónima, aislamiento propio/ajeno y ensayo de rollback/reaplicación dentro de una transacción revertida.
- Responsive automatizado comprobado en 375, 768 y 1280 px, árbol accesible, avatar con nombre accesible, foco visible, ampliación de texto al 200 % y contraste del texto destacado de al menos 4,5:1. La revisión manual se registra por separado y no se infiere del árbol accesible automatizado.
- 2026-10-14: el usuario confirma sin incidencias la revisión manual solicitada («todo perfecto»). Aporta cuatro capturas: perfil propio, perfil público, perfil público en InPrivate (tercera imagen, confirmado expresamente) y perfil inexistente. La confirmación del lector de pantalla procede del reporte del usuario, no de las capturas; no se registró su nombre ni versión.
- La cuarta captura permitió detectar un solapamiento menor del botón de retorno con el mensaje 404. Corregido el flujo de la caja del enlace; una regresión E2E específica comprobó separación vertical, ausencia de desbordamientos y retorno por teclado en 375, 768 y 1280 px. Typecheck y lint del test superados.
- Regresión final del 2026-10-14: 68 pruebas Vitest, E2E Chromium, TypeScript estricto, ESLint, build de producción y escaneo de secretos superados. `test:db:rls` y `test:db:public-profiles` pasaron. La comprobación final por MCP confirmó cero perfiles de prueba residuales, ausencia de lectura anónima sobre la tabla base y disponibilidad de la RPC pública.
- Edición, subida de avatar y cierre integral no se adelantan. Las imágenes existentes solo admiten referencias públicas de `avatars` del origen configurado, sin optimización hasta definir Storage en 2.2.
- Sprint 1.2 completado con pruebas automatizadas y confirmación manual del usuario; Sprint 2.1 desbloqueado. La Fase 2 sigue en curso.

## Hito 2 — Perfil editable con avatar

### Sprint 2.1 — Edición segura de datos propios

**Objetivo:** permitir al propietario actualizar username, nombre visible y biografía sin modificar identidad, rol ni perfiles ajenos.

**Alcance**

- [x] Formulario privado `/perfil/editar` con valores actuales.
- [x] Server Action de actualización propia con resultados controlados.
- [x] RLS y privilegios de columnas verificados para edición.

**Tareas**

- [x] `VIA-007` Implementar la Server Action `updateProfile` con validación compartida, autenticación, propiedad, detección de username ocupado y revalidación de rutas afectadas.
- [x] `VIA-007` Crear el formulario de edición con labels, ayuda contextual, contador de biografía y estados pendiente, éxito, error de campo, conflicto y error temporal.
- [x] `VIA-007` Mantener `clerk_user_id`, `role`, marcas de tiempo e identificador fuera de la entrada editable.
- [x] `VIA-007` Actualizar de forma coherente la navegación cuando cambie el username y evitar referencias públicas obsoletas.
- [x] `Sin identificador existente` Redactar logs y errores de PostgreSQL sin valores de perfil ni detalles internos.

**Criterios de aceptación**

- [x] CA-2.1.1 — El propietario actualiza campos permitidos válidos y ve el resultado en su perfil privado y público.
- [x] CA-2.1.2 — Datos inválidos o username ocupado conservan los datos previos y muestran errores asociados al campo correcto.
- [x] CA-2.1.3 — Una sesión anónima o un usuario distinto no puede editar el perfil; ningún usuario ordinario puede cambiar `role` o `clerk_user_id`.
- [x] CA-2.1.4 — Un fallo de Supabase produce un resultado recuperable, un log redactado y ninguna actualización parcial.
- [ ] CA-2.1.5 — El formulario es usable con teclado, lector de pantalla y controles táctiles en móvil y escritorio.

**Pruebas**

- [x] P-2.1.1 — Unitarias: probar transformación de formulario, normalización, límites y mapeo seguro de conflictos y errores (CA-2.1.1, CA-2.1.2, CA-2.1.4).
- [x] P-2.1.2 — Integración: actualizar correctamente, repetir sin cambios, usar username ocupado, enviar datos inválidos, perder sesión y simular fallo de datos (CA-2.1.1 a CA-2.1.4).
- [x] P-2.1.3 — E2E: editar nombre, bio y username; comprobar la URL pública nueva, persistencia tras recarga y mensajes de un intento inválido (CA-2.1.1, CA-2.1.2).
- [x] P-2.1.4 — Seguridad/RLS: intentar actualización directa de otro perfil, reasignación de identidad, elevación de rol y escritura de columnas no concedidas (CA-2.1.3).
- [ ] P-2.1.5 — Accesibilidad/responsive: verificar labels, descripción de errores, foco tras envío, estado pendiente y ausencia de desbordamientos (CA-2.1.5).

**Evidencia de cierre**

- 2026-10-14: [acción de actualización propia](../../actions/profiles.ts), [servicio tipado](../../lib/profiles/update-profile.ts), [formulario](../../components/profile/EditProfileForm.tsx) y [ruta privada](../../app/perfil/editar/page.tsx) implementados. Se reutilizan el contrato de alta, sus mensajes, límites y normalización; el formulario de alta conserva su comportamiento.
- La sesión se comprueba en cada acción. El ID y username anterior se obtienen de la fila propia en servidor; el `UPDATE` filtra por ese ID y el `sub` autenticado y modifica únicamente username, nombre y biografía en una sola sentencia. Los campos privilegiados y el estado previo enviados por el cliente no deciden identidad, destino ni permisos.
- PostgreSQL mantiene la autoridad sobre la unicidad; un conflicto conserva los datos anteriores y se asocia al campo username. Se distingue sesión no disponible, perfil ausente, respuesta inválida, error de configuración y fallo de red, incluidos errores sin código y HTTP 0. Nunca se informa éxito sin confirmar la fila propia actualizada.
- Tras guardar se revalidan `/perfil`, `/perfil/editar` y las direcciones públicas anterior y nueva. Repetir el guardado sin cambios sigue siendo válido. Al cambiar username, la dirección anterior queda como perfil inexistente, sin alias ni redirección añadidos.
- Regresión local: **107 pruebas Vitest**, TypeScript estricto, ESLint sin advertencias, build de producción y escaneo de secretos superados.
- **Dos E2E Chromium superados**: alta y lectura existentes, edición válida/inválida, username ocupado con fixture independiente, persistencia tras recarga, reenvío sin cambios, URL pública nueva/anterior y conservación del rol `user` al manipular campos de identidad/rol. El segundo caso conserva la regresión del estado 404.
- E2E comprueba contador de biografía, labels, foco en username tras errores y en mensaje tras éxito, bloqueo de campos/botón y anuncio durante un guardado retenido de forma controlada, y ausencia de desbordamientos a 375, 768 y 1280 px.
- [RLS directa](../../supabase/tests/profiles_rls.sql) superada contra el remoto en una transacción revertida: actualización propia de tres campos, conflicto de username atómico, rechazo de modificación ajena para un usuario ordinario, rol, identidad, ID, timestamps y petición anónima. Las políticas jerárquicas preexistentes no se modificaron; no se requirió una nueva migración.
- Limpieza final comprobada por Supabase MCP: **cero perfiles de prueba residuales**. Los E2E eliminaron el usuario Clerk efímero y los dos perfiles de prueba.
- **Pendiente:** revisión manual con lector de pantalla del nuevo formulario de edición (CA-2.1.5/P-2.1.5). La confirmación de Sprint 1.2 no se extrapola a esta interfaz nueva. Sprint 2.1 queda en validación, sin adelantar avatar ni cierre integral.

### Sprint 2.2 — Avatar propio en Supabase Storage

**Objetivo:** permitir subir, reemplazar y retirar un avatar validado, visible en los perfiles privado y público.

**Alcance**

- [ ] Bucket y políticas de Storage para avatares versionados.
- [ ] Flujo privado de subida, reemplazo y eliminación.
- [ ] Avatar responsive con alternativa accesible y fallback.

**Tareas**

- [ ] `VIA-008` Definir y documentar formatos de imagen admitidos, tamaño máximo, validación de contenido y estrategia de rutas por propietario.
- [ ] `VIA-008` Crear una migración para el bucket `avatars` y políticas de lectura y escritura, sin usar credenciales administrativas en el flujo ordinario.
- [ ] `VIA-008` Implementar acciones de subida y retirada que validen sesión, archivo, propiedad y referencia del perfil, y que manejen reemplazos sin objetos huérfanos.
- [ ] `VIA-008` Incorporar selector, previsualización, progreso/estado pendiente, reemplazo, eliminación, fallback y mensajes accesibles en la edición de perfil.
- [ ] `VIA-008` Servir el avatar de forma compatible con la optimización de imágenes y sin aceptar URLs arbitrarias aportadas por el cliente.
- [ ] `Sin identificador existente` Documentar y ensayar rollback de bucket, políticas y referencias de prueba.

**Criterios de aceptación**

- [ ] CA-2.2.1 — El propietario sube una imagen válida y el avatar persiste y se muestra en perfil privado y público.
- [ ] CA-2.2.2 — Archivo vacío, tipo no admitido, contenido incompatible o tamaño excesivo es rechazado antes de actualizar el perfil.
- [ ] CA-2.2.3 — Un usuario no puede escribir, reemplazar ni eliminar objetos de otro; la lectura se limita al contrato público definido.
- [ ] CA-2.2.4 — Reemplazar o retirar el avatar actualiza referencia y objeto sin dejar datos inconsistentes u objetos de prueba residuales.
- [ ] CA-2.2.5 — Fallos parciales de Storage o base de datos se presentan de forma recuperable y se registran sin rutas firmadas ni datos personales.
- [ ] CA-2.2.6 — El avatar tiene texto alternativo o tratamiento decorativo correcto, dimensiones estables y no deforma la interfaz responsive.

**Pruebas**

- [ ] P-2.2.1 — Unitarias: validar metadatos, contenido, tamaño, extensión normalizada y construcción de ruta propia (CA-2.2.1, CA-2.2.2).
- [ ] P-2.2.2 — Integración: subir, reemplazar y retirar avatar; simular error de Storage y de actualización de perfil comprobando compensación (CA-2.2.1, CA-2.2.4, CA-2.2.5).
- [ ] P-2.2.3 — E2E: seleccionar imagen válida, verla tras recarga y en perfil público, reemplazarla, retirarla y probar un archivo inválido (CA-2.2.1, CA-2.2.2, CA-2.2.6).
- [ ] P-2.2.4 — Seguridad/RLS/Storage: probar lectura permitida y escrituras propias/ajenas directamente contra Storage, incluidas rutas manipuladas y sesión ausente (CA-2.2.3).
- [ ] P-2.2.5 — Migración/rollback: aplicar y retirar bucket/políticas en entorno de prueba, verificando ausencia de objetos residuales (CA-2.2.4).
- [ ] P-2.2.6 — Accesibilidad/responsive: comprobar nombre accesible de controles, foco, anuncio de errores, dimensiones estables y vistas móvil/escritorio (CA-2.2.6).

**Evidencia de cierre**

- Pendiente.

## Hito 3 — Roles y rutas protegidas

### Sprint 3.1 — Autorización integral del sistema de usuarios

**Objetivo:** cerrar el sistema de usuarios demostrando que cada ruta, acción, fila y archivo aplica autenticación, propiedad y rol sin confiar en la interfaz.

**Alcance**

- [ ] Matriz de acceso para rutas públicas, privadas y de onboarding.
- [ ] Rol visible de solo lectura y autorización centralizada.
- [ ] Recorrido desplegado de alta, consulta, edición y avatar.

**Tareas**

- [ ] `Sin identificador existente` Centralizar guardas para `/perfil`, `/perfil/completar` y `/perfil/editar`, conservando `/usuario/[username]` como ruta pública de datos limitados.
- [ ] `VIA-006` Resolver el rol desde `profiles` en servidor y tratar rol ausente, desconocido o fallo de datos de forma cerrada.
- [ ] `VIA-007` Auditar que todas las mutaciones vuelvan a comprobar sesión, propiedad y referencias aunque el cliente altere formularios o invoque acciones directamente.
- [ ] `VIA-008` Auditar que las políticas de Storage y datos sean equivalentes a las comprobaciones de aplicación.
- [ ] `Sin identificador existente` Ejecutar el recorrido completo en los entornos autorizados y revisar que respuestas, logs y bundle no expongan secretos ni datos internos.

**Criterios de aceptación**

- [ ] CA-3.1.1 — Las rutas privadas redirigen sesiones ausentes o expiradas; las rutas de completar/editar responden según exista o no perfil y la ruta pública no revela datos privados.
- [ ] CA-3.1.2 — El rol almacenado se muestra como solo lectura y cualquier valor desconocido o intento de elevación falla cerrado.
- [ ] CA-3.1.3 — Alterar cliente, formulario, username, identificador de perfil o ruta de Storage no permite actuar sobre otro usuario.
- [ ] CA-3.1.4 — El flujo Google → alta de perfil → avatar → edición → perfil público → logout funciona en móvil y escritorio en cada entorno autorizado.
- [ ] CA-3.1.5 — TypeScript estricto, lint, build, pruebas y escaneo de secretos terminan correctamente sin credenciales administrativas en la aplicación.

**Pruebas**

- [ ] P-3.1.1 — Unitarias: probar decisión de ruta y rol con perfil ausente, `user`, rol desconocido y estado de datos no disponible (CA-3.1.1, CA-3.1.2).
- [ ] P-3.1.2 — Integración: invocar consultas y acciones con sesión válida, ausente, expirada, identidad ajena y referencias manipuladas (CA-3.1.1 a CA-3.1.3).
- [ ] P-3.1.3 — E2E: ejecutar el recorrido completo de usuario y repetir acceso directo anónimo a rutas privadas en móvil y escritorio (CA-3.1.4).
- [ ] P-3.1.4 — Seguridad/RLS/Storage: ejecutar la matriz directa como anónimo, propietario y otro usuario para filas y objetos; confirmar rechazo de elevación de rol (CA-3.1.2, CA-3.1.3).
- [ ] P-3.1.5 — Configuración/build: ejecutar typecheck, lint, build, suite completa y escaneo de secretos; inspeccionar que no exista `service_role` en código ni bundle (CA-3.1.5).
- [ ] P-3.1.6 — Accesibilidad/responsive: recorrer alta, perfil, edición y avatar con teclado, lector de pantalla y vistas móvil/escritorio (CA-3.1.4).

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

## Registro de progreso

| Fecha | Sprint | Estado | Evidencia | Notas |
| --- | --- | --- | --- | --- |
| 2026-10-01 | 1.1 | Completado | Contrato, migraciones remotas, Server Action, formulario, 27 pruebas, E2E Playwright, matriz jerárquica RLS, bootstrap admin, rollback, build e integración HTTP superados. | Usuario y perfil E2E eliminados al finalizar. |
| 2026-10-14 | 1.2 | Completado | Consultas/vistas propias y públicas, RPC remota, pruebas locales, E2E responsive, permisos directos, rollback transaccional y revisión manual confirmada por el usuario. | P-1.2.5 completada; tercera captura en InPrivate. |
| 2026-10-14 | 2.1 | En validación | Edición propia, 107 pruebas, dos E2E, RLS transaccional, tipos, lint, build y secretos superados; cero fixtures residuales. | Pendiente revisión manual con lector de pantalla del formulario nuevo. |
| 2026-09-29 | 2.2 | Pendiente | — | Depende de edición y Storage disponible. |
| 2026-09-29 | 3.1 | Pendiente | — | Cierre integral tras completar los hitos anteriores. |