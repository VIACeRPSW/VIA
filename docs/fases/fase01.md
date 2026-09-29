# VIA — Fase 01: Base técnica

## Estado

- Estado: En curso
- Roadmap: Fase 1
- Dependencias: aprobación explícita de la documentación de Fase 0 (sin evidencia registrada); repositorio Git existente; cuentas y proyectos de Clerk, Supabase y Vercel; configuración externa de Google como método de acceso en Clerk; decisión aceptada de compartir la misma configuración de servicios entre Preview y Production o, en su defecto, valores separados bajo los mismos nombres de variables.
- Criterio de salida: aplicación Next.js ejecutándose con autenticación de Clerk, bienvenida privada posterior al acceso y conexión autenticada a Supabase protegida por RLS.

## Objetivo

Establecer una base ejecutable y desplegable de VIA con Next.js, React, TypeScript, Tailwind CSS, Clerk y Supabase. Al finalizar, una persona podrá registrarse o iniciar sesión mediante Google, será redirigida a una bienvenida privada en `/perfil`, verá su identidad de Clerk y la categoría inicial `user`, podrá cerrar sesión y no podrá acceder a la ruta sin autenticarse.

La categoría `user` será el único valor inicial permitido para nuevas identidades y no otorgará privilegios de moderación o administración. La bienvenida de `/perfil` será un armazón provisional: la creación, consulta y edición del perfil persistente de VIA se implementarán en Fase 2.

## Trazabilidad

| Fuente | Elementos cubiertos |
| --- | --- |
| Roadmap | Crear y verificar el repositorio; crear proyecto Next.js; configurar TypeScript, Tailwind, Clerk, Supabase y variables de entorno; establecer la estructura de carpetas; crear migraciones y RLS inicial; demostrar autenticación y conexión de datos. |
| Backlog | `VIA-001`, `VIA-002`, `VIA-003`, `VIA-004`, `VIA-005`. |
| Requisitos | `RF-01`; `RNF-01`, `RNF-02`, `RNF-04`, `RNF-05`, `RNF-06`; ERS 3 (rol Usuario); Arquitectura 2, 3 y 7; Seguridad 1, 2, 3, 4, 7 y 8; Estructura Next.js 1, 2, 4 y 5; Configuración 2 a 8; Testing `E2E-01` y sección 5. |

## Fuera de alcance

- Crear, editar o publicar el perfil persistente de VIA (`VIA-006`, `VIA-007` y `VIA-008`), incluidos username, biografía y avatar; corresponde a Fase 2.
- Implementar el feed real de `/inicio`, publicaciones, Storage y buckets; corresponden a fases posteriores.
- Permitir que un usuario se asigne o cambie a `moderator` o `admin`; la gestión de roles corresponde a Fase 7.
- Incorporar otros proveedores sociales además de Google o personalizar en profundidad las pantallas alojadas por Clerk.
- Desplegar a Vercel o modificar recursos remotos sin una petición explícita; esta fase deja la configuración preparada y documentada.

## Riesgos y decisiones

| Tipo | Descripción | Mitigación o decisión requerida |
| --- | --- | --- |
| Bloqueo | No existe evidencia de aprobación de la documentación de Fase 0. | Registrar la aprobación antes de cerrar el Sprint 1.1; no ampliar requisitos mientras permanezca pendiente. |
| Dependencia externa | Google debe estar habilitado en Clerk y sus URLs de retorno deben admitir desarrollo, Preview y Production. | Configurar dominios autorizados sin guardar credenciales en el repositorio y verificar cada entorno. |
| Riesgo | Compartir valores reales de Clerk y Supabase entre Preview y Production puede exponer datos de producción desde despliegues de prueba. | Usar los mismos nombres de variables en ambos entornos; si se comparten valores por decisión del proyecto, limitar acceso a previews, registrar la decisión y ejecutar pruebas sin datos sensibles. Se recomienda separar instancias cuando haya datos reales. |
| Riesgo | Mostrar `user` en la bienvenida podría confundirse con un perfil persistente ya creado. | Etiquetarlo como categoría inicial de acceso y mantener fuera de Fase 1 cualquier alta o edición de `profiles`. |
| Riesgo | Una clave privada podría llegar al cliente o a Git. | Mantener secretos sin prefijo `NEXT_PUBLIC_`, ignorar `.env.local`, ofrecer solo `.env.example` sin valores y comprobar historial/diff antes del cierre. |
| Decisión | Clerk es la fuente de identidad y Supabase la fuente de datos; una etiqueta visual no concede permisos. | Resolver identidad en servidor y aplicar autorización tanto en aplicación como mediante RLS. |
| Riesgo | La integración de tokens Clerk-Supabase puede variar según las versiones elegidas. | Fijar versiones compatibles, documentar el mecanismo vigente y validarlo con una consulta autenticada y pruebas directas de RLS. |

## Hito 1 — Aplicación local reproducible

### Sprint 1.1 — Base Next.js verificable

**Objetivo:** disponer de una aplicación Next.js mínima que compile, aplique las convenciones del proyecto y pueda configurarse sin exponer secretos.

**Alcance**

- [x] Repositorio verificado y proyecto Next.js creado con App Router, TypeScript estricto, ESLint y Tailwind CSS.
- [x] Estructura inicial de rutas y módulos alineada con `docs/inicio/06-estructura-nextjs.md`.
- [x] Contrato de variables de entorno documentado para desarrollo local y Vercel.

**Tareas**

- [x] `VIA-001` Verificar el repositorio existente e inicializar Next.js en su raíz sin sobrescribir `docs/` ni `.github/`.
- [x] `VIA-001` Activar TypeScript estricto, App Router, ESLint y Tailwind CSS con scripts de desarrollo, lint, comprobación de tipos y build.
- [x] `VIA-001` Crear únicamente la estructura inicial necesaria en `app/`, `components/`, `lib/`, `actions/`, `types/` y `public/`, evitando módulos vacíos sin uso.
- [x] `Sin identificador existente` Añadir `.env.example` sin valores y asegurar que `.env.local` y variantes locales estén ignoradas por Git.
- [x] `Sin identificador existente` Documentar las variables conceptuales de Clerk y Supabase, distinguiendo las públicas de las exclusivas del servidor y su carga en Development, Preview y Production de Vercel.
- [x] `Sin identificador existente` Registrar la versión de Node.js soportada y los pasos de primer arranque.

**Criterios de aceptación**

- [x] CA-1.1.1 — Una instalación limpia permite iniciar la aplicación y renderizar la portada sin errores.
- [x] CA-1.1.2 — TypeScript estricto, ESLint y el build de producción terminan correctamente.
- [x] CA-1.1.3 — Tailwind CSS se aplica a una interfaz responsive, semántica, con foco visible y contraste suficiente.
- [x] CA-1.1.4 — `.env.local` no queda rastreado y ningún archivo versionado contiene valores secretos.
- [x] CA-1.1.5 — Las variables requeridas y el procedimiento para configurarlas localmente y en los tres entornos de Vercel están documentados sin credenciales reales.
- [ ] CA-1.1.6 — La documentación de Fase 0 dispone de aprobación registrada o el bloqueo continúa explícito y evita cerrar la fase.

**Pruebas**

- [x] P-1.1.1 — Unitarias: no aplica; este sprint no introduce lógica aislada. Se valida la configuración mediante compilador y herramientas del framework (CA-1.1.2).
- [x] P-1.1.2 — Integración: ejecutar instalación limpia, comprobación de tipos, lint y build con el contrato de entorno documentado (CA-1.1.1, CA-1.1.2, CA-1.1.5).
- [x] P-1.1.3 — E2E: abrir la portada en escritorio y móvil, comprobar renderizado, navegación por teclado, foco y ausencia de desbordamientos (CA-1.1.1, CA-1.1.3).
- [x] P-1.1.4 — Seguridad/RLS: comprobar con Git que `.env.local` está ignorado y buscar patrones de claves o tokens en archivos rastreados; RLS aún no aplica (CA-1.1.4).
- [ ] P-1.1.5 — Verificación documental: registrar la aprobación de Fase 0 o mantener el bloqueo abierto (CA-1.1.6).

**Evidencia de cierre**

- 2026-09-29: Next.js 16.3.7, React 19.2.8, TypeScript estricto, Tailwind CSS 4 y ESLint instalados con npm; auditoría de instalación sin vulnerabilidades conocidas.
- 2026-09-29: `npm run typecheck`, `npm run lint` y `npm run build` superados; `/` respondió HTTP 200 en el servidor local.
- 2026-09-29: `.env.local` confirmado como ignorado y `.env.example` confirmado como versionable; no se detectaron valores de claves en los archivos de código y configuración revisados.
- 2026-09-29: verificación manual superada en móvil, tablet y escritorio, sin solapamientos ni desplazamiento horizontal; navegación por teclado y foco visible confirmados.
- Pendiente: aprobación registrada de Fase 0.

## Hito 2 — Acceso autenticado y bienvenida privada

### Sprint 2.1 — Clerk con Google y sesión protegida

**Objetivo:** completar el flujo registro/login con Google, redirección a una bienvenida privada y cierre de sesión sin implementar todavía el perfil persistente.

**Alcance**

- [x] Clerk integrado en la raíz de Next.js con rutas de acceso y registro.
- [x] Google habilitado como método de autenticación externo.
- [x] Ruta privada `/perfil` como bienvenida provisional basada en la identidad de Clerk.
- [x] Redirecciones coherentes para sesiones válidas, ausentes y cerradas.

**Tareas**

- [x] `VIA-002` Integrar el proveedor de Clerk y su mecanismo vigente de protección de rutas para la versión instalada.
- [x] `VIA-002` Crear las rutas de inicio de sesión y registro y configurar la redirección posterior a `/perfil`.
- [x] `VIA-002` Habilitar Google en Clerk y documentar las URLs autorizadas para local, Preview y Production sin incluir secretos.
- [x] `VIA-002` Implementar `/perfil` como Server Component privado que muestre un saludo con nombre o correo de Clerk, estado de sesión, categoría inicial `user` y control de cierre de sesión.
- [ ] `VIA-002` Presentar estados accesibles y comprensibles para identidad incompleta, configuración ausente y error de autenticación, sin revelar detalles internos.
- [x] `Sin identificador existente` Diseñar la portada y la bienvenida para móvil y escritorio con HTML semántico, foco visible y controles táctiles suficientes.

**Criterios de aceptación**

- [x] CA-2.1.1 — Una persona puede registrarse o iniciar sesión con una cuenta de Google y termina en `/perfil`.
- [x] CA-2.1.2 — La bienvenida muestra datos disponibles de la identidad autenticada y la categoría inicial `user`, sin afirmar que existe un perfil persistente de VIA.
- [x] CA-2.1.3 — Una petición no autenticada a `/perfil` es redirigida al acceso y no recibe contenido privado.
- [x] CA-2.1.4 — Cerrar sesión invalida el acceso y devuelve a una ruta pública.
- [ ] CA-2.1.5 — La aplicación maneja identidad sin nombre, configuración incompleta y fallos de Clerk con mensajes controlados y observabilidad sin datos sensibles.
- [x] CA-2.1.6 — Portada, acceso y bienvenida son utilizables mediante teclado y no presentan solapamientos en móvil ni escritorio.

**Pruebas**

- [ ] P-2.1.1 — Unitarias: probar la transformación de identidad de Clerk a los datos seguros de bienvenida, incluidos nombre ausente y correo ausente (CA-2.1.2, CA-2.1.5).
- [ ] P-2.1.2 — Integración: verificar proveedor, protección de `/perfil`, redirecciones y cierre de sesión con sesión válida, ausente y expirada (CA-2.1.3, CA-2.1.4, CA-2.1.5).
- [x] P-2.1.3 — E2E: ejecutar `E2E-01` con Google en un usuario de prueba: registro/login, llegada a `/perfil`, saludo visible y logout; repetir intento directo sin sesión (CA-2.1.1 a CA-2.1.4).
- [ ] P-2.1.4 — Seguridad/RLS: confirmar que las claves secretas de Clerk solo se consumen en servidor, que la respuesta privada no se almacena públicamente y que el cliente no puede alterar la categoría mostrada para obtener permisos; RLS de datos se cubre en el Hito 3 (CA-2.1.2, CA-2.1.3).
- [x] P-2.1.5 — Accesibilidad/responsive: comprobar navegación por teclado, nombre accesible del logout, foco, contraste y vistas móvil/escritorio de portada, acceso y bienvenida (CA-2.1.6).

**Evidencia de cierre**

- 2026-09-29: Clerk CLI 3.3.0 autenticado y aplicación `app_3K0QOI6JHp1l7SyhO3Yga8QjX1x` vinculada mediante `clerk init`; `clerk doctor` superado.
- 2026-09-29: `ClerkProvider` dentro de `body`, rutas `/sign-in` y `/sign-up`, controles visibles con `Show`, `SignInButton`, `SignUpButton` y `UserButton`, y matcher `'/__clerk/:path*'` verificados.
- 2026-09-29: `/perfil` anónimo respondió HTTP 307 hacia `/sign-in` conservando la URL de retorno; build, tipos y lint superados.
- 2026-09-29: verificación manual del usuario superada con Google: login, redirección a `/perfil`, bienvenida con categoría `user`, retorno tras logout y revisión visual satisfactoria de portada y bienvenida.
- 2026-09-29: verificación manual responsive y por teclado superada en portada y bienvenida, incluido foco visible y control de cierre de sesión.
- Pendiente: automatizar casos de identidad incompleta y sesión expirada.

## Hito 3 — Datos protegidos e integración desplegable

### Sprint 3.1 — Esquema inicial, migraciones y RLS

**Objetivo:** versionar el esquema mínimo de Fase 1 y demostrar que la base de datos impide por defecto accesos o elevaciones de rol no autorizados.

**Alcance**

- [x] Herramientas de Supabase configuradas y migración inicial versionada.
- [x] Base de la tabla `profiles` preparada para Fase 2 con rol inicial `user` y RLS habilitado.
- [x] Políticas iniciales, pruebas directas de permisos y procedimiento de rollback.

**Tareas**

- [x] `VIA-003` Configurar clientes de Supabase separados por contexto, sin crear cliente de navegador mientras no exista un caso que lo requiera.
- [x] `VIA-004` Crear una migración mínima y versionada para `profiles`, con identificador de Clerk único, campos base, restricciones, marcas de tiempo y rol limitado a `user`, `moderator` o `admin` con valor inicial `user`.
- [x] `VIA-004` Añadir únicamente los índices y funciones auxiliares requeridos por las consultas y políticas de esta fase.
- [x] `VIA-005` Habilitar RLS en `profiles` y crear políticas de mínimo privilegio basadas en la identidad autenticada de Clerk.
- [x] `VIA-005` Impedir que un usuario cree o modifique su rol a `moderator` o `admin`; cualquier operación privilegiada futura deberá usar un flujo administrativo de servidor.
- [x] `VIA-004` Documentar y ensayar un rollback que retire de forma segura los objetos creados por la migración.
- [x] `Sin identificador existente` Mantener el aprovisionamiento automático y la edición funcional de perfiles fuera de esta fase; usar datos efímeros de prueba para validar RLS.

**Criterios de aceptación**

- [x] CA-3.1.1 — Una base vacía puede aplicar la migración inicial de forma reproducible y obtiene tablas, restricciones e índices esperados.
- [x] CA-3.1.2 — Todo nuevo registro de prueba que omite el rol recibe `user`, y un rol fuera del conjunto permitido es rechazado.
- [x] CA-3.1.3 — Un usuario autenticado solo puede leer o modificar la fila propia permitida por las políticas; una sesión anónima o con otro `sub` es rechazada.
- [x] CA-3.1.4 — Un usuario ordinario no puede elevar su rol ni insertar una identidad ajena, incluso accediendo directamente a Supabase.
- [x] CA-3.1.5 — El rollback ensayado elimina los objetos de la fase y permite volver a aplicar la migración sin intervención manual en el panel.
- [x] CA-3.1.6 — Ninguna clave con privilegios administrativos se expone al navegador ni se utiliza para el acceso ordinario de la aplicación.

**Pruebas**

- [x] P-3.1.1 — Unitarias: validar la construcción y lectura de claims de identidad usada por las políticas, con `sub` válido, ausente y malformado (CA-3.1.3, CA-3.1.4). Se cubrió directamente en PostgreSQL porque la lectura de claims pertenece a `auth.jwt()` y no a una utilidad de aplicación aislable.
- [x] P-3.1.2 — Integración: levantar una base limpia, aplicar migraciones, verificar esquema, restricciones, valor inicial `user` y rechazo de roles inválidos (CA-3.1.1, CA-3.1.2).
- [x] P-3.1.3 — E2E: no aplica; este sprint valida una barrera de datos sin flujo de perfil funcional. La integración visible se prueba en el Sprint 3.2.
- [x] P-3.1.4 — Seguridad/RLS: ejecutar consultas directas como anónimo, usuario propietario y otro usuario; probar `SELECT`, `INSERT` y `UPDATE`, incluida elevación de rol e identidad ajena (CA-3.1.3, CA-3.1.4, CA-3.1.6).
- [x] P-3.1.5 — Migración/rollback: aplicar, revertir y volver a aplicar sobre una base desechable, comparando el esquema resultante (CA-3.1.1, CA-3.1.5).

**Evidencia de cierre**

- 2026-09-29: Supabase CLI 2.118.0 inicializada y proyecto `rdhzfxmrblqsigtdnaid` enlazado sin almacenar la contraseña de PostgreSQL en el repositorio.
- 2026-09-29: migración `20260929000100_create_profiles.sql` aplicada al remoto; historial local/remoto sincronizado y `supabase db lint --linked --level warning` sin errores.
- 2026-09-29: prueba directa con clave publicable: `SELECT` e `INSERT` anónimos sobre `profiles` rechazados con HTTP 401; credenciales no mostradas.
- 2026-09-29: template JWT `supabase` creado en Clerk con `aud` y `role` `authenticated`; cliente Supabase exclusivo de servidor compilado con token de Clerk.
- 2026-09-29: Third-Party Auth de Supabase configurado con el dominio de Clerk; una sesión Google válida consultó `profiles` bajo RLS y mostró correctamente que el perfil aún no existe.
- 2026-09-29: `npm run test:db:rls` superado contra el remoto dentro de una transacción reversible: rol inicial `user`, lectura y actualización propias, aislamiento de otro `sub`, rechazo de identidad ajena y bloqueo de creación o cambio a `admin`; la comprobación posterior confirmó cero filas efímeras residuales.
- 2026-09-29: `npm run test:db:rollback` eliminó `profiles`, verificó su ausencia, reaplicó la migración y verificó su restauración dentro de una única transacción remota finalizada con `ROLLBACK`; el lint remoto quedó limpio y el historial local/remoto permaneció sincronizado. No se requirió Docker.
- 2026-09-29: ampliación de `npm run test:db:rls` superada para rol desconocido, claims sin `sub` y claims con JSON malformado; todos los casos fallaron cerrados y la comprobación posterior confirmó cero filas residuales.
- 2026-09-29: comparación de catálogo antes y después de rollback/reaplicación superada para columnas, restricciones, políticas, trigger, RLS, permisos de tabla y columna, y función auxiliar. Sprint 3.1 completado.

### Sprint 3.2 — Conexión autenticada y preparación de Vercel

**Objetivo:** demostrar de extremo a extremo que una sesión de Clerk alcanza Supabase bajo RLS y que la misma aplicación puede configurarse de forma segura en entornos de Vercel.

**Alcance**

- [x] Integración autenticada Clerk-Supabase desde servidor.
- [x] Estado de conexión de datos incorporado a la bienvenida privada sin crear el perfil de Fase 2.
- [ ] Configuración y verificación documentadas para Local, Preview y Production.

**Tareas**

- [x] `VIA-003` Integrar el mecanismo vigente de token Clerk-Supabase y centralizar el cliente autenticado en `lib/`.
- [x] `VIA-003` Realizar desde `/perfil` una consulta mínima protegida por RLS que distinga conexión correcta, ausencia esperada de perfil y fallo del servicio.
- [x] `VIA-003` Añadir manejo de errores y registro técnico sin tokens, correos completos ni detalles internos de base de datos.
- [x] `Sin identificador existente` Configurar en Vercel los mismos nombres de variables para Development, Preview y Production; registrar si Preview y Production comparten valores reales conforme a la decisión del proyecto.
- [ ] `VIA-002` Verificar las URLs y redirecciones de Clerk para dominios local, Preview y Production.
- [x] `Sin identificador existente` Documentar la lista de comprobación de despliegue sin ejecutar despliegues ni cambios remotos salvo autorización explícita.

**Criterios de aceptación**

- [x] CA-3.2.1 — Una sesión válida de Clerk realiza desde servidor una consulta a Supabase con su identidad y RLS activa, sin usar credenciales administrativas.
- [x] CA-3.2.2 — La bienvenida diferencia de forma accesible entre conexión disponible sin perfil aún creado y error temporal de datos, sin filtrar información interna.
- [x] CA-3.2.3 — Una sesión ausente, expirada o con token inválido no puede utilizar la conexión autenticada ni leer filas protegidas.
- [x] CA-3.2.4 — Los contratos de variables y redirecciones quedan definidos para Local, Preview y Production con los mismos nombres y sin valores versionados.
- [x] CA-3.2.5 — Un build de producción termina correctamente con la validación de entorno prevista y la configuración no incluye secretos en el bundle cliente.
- [x] CA-3.2.6 — El recorrido login con Google, bienvenida, comprobación de datos y logout funciona en móvil y escritorio en cada entorno que haya sido autorizado para probar.

**Pruebas**

- [x] P-3.2.1 — Unitarias: probar la clasificación de resultados de conexión —disponible sin perfil, no autorizado, configuración inválida y error temporal— y la redacción de datos sensibles en logs (CA-3.2.2).
- [x] P-3.2.2 — Integración: intercambiar una sesión de prueba de Clerk por el token admitido, consultar Supabase con RLS y repetir con sesión ausente, expirada y token alterado (CA-3.2.1, CA-3.2.3).
- [x] P-3.2.3 — E2E: ejecutar login Google, llegada a `/perfil`, identidad y categoría `user`, estado correcto de datos y logout; repetir en los entornos autorizados y vistas móvil/escritorio (CA-3.2.6).
- [x] P-3.2.4 — Seguridad/RLS: inspeccionar el bundle y las respuestas de red para descartar secretos; confirmar con acceso directo que el token de otro usuario no lee filas ajenas (CA-3.2.1, CA-3.2.3, CA-3.2.5).
- [x] P-3.2.5 — Configuración/build: validar variables requeridas por entorno, redirecciones permitidas y build de producción sin imprimir valores; revisar que `.env.local` sigue ignorado (CA-3.2.4, CA-3.2.5).
- [x] P-3.2.6 — Error controlado: simular indisponibilidad de Supabase y comprobar mensaje accesible, respuesta no sensible y registro técnico redactado (CA-3.2.2).

**Evidencia de cierre**

- 2026-09-29: consulta autenticada Clerk → Supabase confirmada manualmente en `/perfil`; la respuesta bajo RLS fue “Conexión lista; perfil pendiente de la Fase 2”.
- 2026-09-29: fallo previo `401 PGRST301` se presentó como estado controlado sin datos internos y quedó resuelto al registrar Clerk en Third-Party Auth de Supabase.
- 2026-09-29: protección por recurso verificada tras retirar `createRouteMatcher` deprecado: `/perfil` anónimo respondió HTTP 307 a `/sign-in`; typecheck, lint, build y lint remoto de Supabase superados.
- 2026-09-29: Vitest 4 configurado según la guía local de Next.js 16; `npm test` superó cinco casos para conexión sin perfil, perfil existente, no autorizado, configuración inválida, error temporal y redacción de mensajes, correos y tokens simulados.
- 2026-09-29: acceso a `profiles` y clasificación de errores extraídos de la página a una capa `server-only` en `lib/`; TypeScript estricto, ESLint y build de producción superados.
- 2026-09-29: `npm run test:client-secrets` inspeccionó `.next/static` y confirmó que ningún valor privado configurado aparece en el bundle cliente; el aislamiento frente a otro `sub` ya estaba demostrado directamente por la prueba RLS.
- 2026-09-29: `npm run test:db:auth-boundary` confirmó por HTTP 401 que Supabase rechaza una consulta anónima y la misma consulta con un JWT alterado, sin imprimir cuerpo de respuesta ni credenciales.
- 2026-09-29: README actualizado con el contrato completo de variables para Development, Preview y Production, rutas de acceso y retorno, exposición cliente/servidor y checklist de Clerk, Supabase, Vercel y validación previa.
- 2026-09-29: proyecto `via-17d8/via` creado en Vercel y conectado a `VIACeRPSW/VIA`; las ocho variables requeridas se configuraron en Development, Preview y Production, con `CLERK_SECRET_KEY` como secreto y el resto conforme a su exposición documentada.
- 2026-09-29: despliegue Production completado desde el commit `5c1328d`, alias `https://via-ivory.vercel.app` y respuesta HTTP 200 confirmada mediante Vercel Authentication; los push a `main` quedaron conectados para despliegue automático.
- Decisión temporal: Preview y Production comparten la instancia de desarrollo de Clerk y el proyecto Supabase mientras no existan datos reales. Clerk Production, dominio propio y Google OAuth de producción se posponen explícitamente.
- 2026-09-29: E2E manual desplegado superado en escritorio y vista móvil: acceso Google, llegada a `/perfil`, categoría `user`, estado “Conexión lista; perfil pendiente de la Fase 2”, cierre de sesión y redirección de `/perfil` anónimo a `/sign-in`.
- 2026-09-29: `npm test` superó seis casos; la orquestación usada por `/perfil` simuló indisponibilidad HTTP 503, devolvió “Datos temporalmente no disponibles” y registró únicamente código y estado, sin mensaje interno ni correo simulados. Typecheck, lint y build superados.
- 2026-09-29: `npm run test:clerk:expired-session` creó una sesión aislada de Clerk Development, confirmó HTTP 200 en `/perfil` con un token válido y, tras su expiración real de 60 segundos más la tolerancia de Clerk, confirmó HTTP 307 hacia `/sign-in`; la sesión temporal se revocó en `finally` sin mostrar identificadores ni JWT.
- 2026-09-29: validación posterior superada: seis pruebas Vitest, typecheck, lint, build de producción, escaneo del bundle cliente, frontera HTTP de autenticación Supabase, RLS remota y rollback/reaplicación remotos.
- Pendiente: Clerk Production queda bloqueado hasta disponer de dominio propio.

## Validación final de la fase

- [ ] Todos los criterios de aceptación están verificados.
- [ ] Pruebas unitarias, integración y E2E requeridas superadas.
- [ ] Permisos de aplicación, RLS y Storage verificados cuando aplican; Storage no aplica porque se reserva para fases posteriores.
- [ ] Migraciones y procedimiento de rollback validados cuando aplican.
- [ ] Accesibilidad y responsive comprobados cuando existe UI.
- [ ] Documentación base actualizada si cambió una decisión.
- [ ] Criterio de salida del roadmap demostrado.
- [ ] Cada punto de Fase 1 del roadmap está asignado a un sprint y cada criterio de aceptación tiene una prueba asociada.
- [ ] El bloqueo de aprobación de Fase 0 está resuelto antes de declarar cerrada la fase.

## Registro de progreso

| Fecha | Sprint | Estado | Evidencia | Notas |
| --- | --- | --- | --- | --- |
| 2026-09-29 | 1.1 | En curso | Typecheck, lint, build, HTTP `/`, responsive y teclado superados; secretos locales ignorados. | Pendiente aprobación registrada de Fase 0. |
| 2026-09-29 | 2.1 | En curso | `clerk doctor`, E2E Google login → `/perfil` → logout, responsive y teclado superados; expiración real automatizada. | Pendiente identidad incompleta. |
| 2026-09-29 | 3.1 | Completado | Migración remota, restricciones, claims válidos/ausentes/malformados, RLS, rollback/reaplicación con comparación de catálogo y lint remoto superados. | Pruebas remotas reversibles, sin Docker ni datos residuales. |
| 2026-09-29 | 3.2 | En curso | Consulta Clerk → Supabase bajo RLS, rechazo de sesión ausente/token alterado/expirado, fallo controlado de datos, Vercel Production y E2E responsive Google → `/perfil` → logout superados. | Clerk Production queda pospuesto hasta disponer de dominio propio. |