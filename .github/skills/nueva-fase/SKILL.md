---
name: nueva-fase
description: "Crea el siguiente documento de fase de VIA en docs/fases/faseNN.md, desglosado en hitos y sprints con criterios de aceptación y pruebas. Usar con /nueva-fase al iniciar o planificar una fase del roadmap."
argument-hint: "[número o nombre de fase] [restricciones opcionales]"
user-invocable: true
disable-model-invocation: false
---

# Nueva fase de VIA

Genera el plan ejecutable de una fase de VIA. El documento resultante debe permitir construir la aplicación incrementalmente y cerrar cada sprint con evidencia verificable.

Este comando solo crea y valida el plan de fase; no inicia su implementación. Los sprints se dimensionan por un resultado verificable, sin imponer una duración fija.

## Entradas

- Acepta opcionalmente un número, nombre de fase o restricciones en el argumento de `/nueva-fase`.
- Sin número explícito, detecta el mayor archivo `docs/fases/faseNN.md` y usa el siguiente. Si la carpeta está vacía, empieza por `fase01.md`.
- El número `NN` corresponde a la misma fase de `docs/inicio/12-roadmap.md`: `fase01.md` implementa "Fase 1 — Base técnica".

## Procedimiento

1. Lee todos los documentos de `docs/inicio/`, comenzando por `00-indice-documentacion.md`.
2. Inspecciona `docs/fases/` y determina la fase solicitada o la siguiente disponible.
3. Busca la fase correspondiente en `docs/inicio/12-roadmap.md` y relaciona sus tareas con `docs/inicio/14-backlog-inicial.md`.
4. Comprueba las dependencias y criterios de salida de fases anteriores. Registra como bloqueo cualquier requisito previo no satisfecho; no lo ocultes ampliando el alcance.
5. Divide la fase en hitos de valor observable y cada hito en sprints pequeños, ordenados por dependencias.
6. Define para cada sprint alcance, tareas, criterios de aceptación y pruebas. Incluye casos exitosos, errores, datos inválidos, autenticación, autorización y RLS cuando apliquen.
7. Crea un único archivo `docs/fases/faseNN.md` con dos dígitos. No sobrescribas un archivo existente ni generes otro nombre para evitar el conflicto: informa del conflicto y detente.
8. Revisa que todo elemento del roadmap de la fase esté asignado a un hito y que cada criterio tenga al menos una prueba o verificación asociada.

## Reglas de planificación

- Mantén la fase dentro del alcance y orden de `docs/inicio/12-roadmap.md`.
- Prioriza incrementos verticales demostrables sobre capas técnicas aisladas, excepto en la fase de base técnica.
- Define cada sprint por un resultado verificable y no por una duración temporal predeterminada.
- Vincula tareas del backlog como `VIA-001` cuando exista correspondencia; no inventes identificadores VIA.
- Declara dependencias externas de Clerk, Supabase y Vercel, pero nunca incluyas secretos ni valores reales de variables de entorno.
- Incluye migraciones, RLS, políticas de Storage y rollback cuando la fase cambie datos o archivos.
- Incluye accesibilidad y responsive cuando la fase añada interfaz.
- Incluye observabilidad y manejo de errores cuando la fase añada operaciones de servidor.
- Marca todo trabajo inicialmente con casillas sin completar. Una casilla solo se completa después de obtener evidencia.
- Si se solicita una fase que no existe en el roadmap, pide actualizar primero `docs/inicio/12-roadmap.md`.

## Estructura obligatoria del documento

Usa exactamente estas secciones, adaptando su contenido a la fase:

```markdown
# VIA — Fase NN: <nombre>

## Estado

- Estado: Planificada
- Roadmap: Fase N
- Dependencias: <fases, servicios o decisiones>
- Criterio de salida: <resultado observable del roadmap>

## Objetivo

<Valor que entrega la fase y límites de alcance.>

## Trazabilidad

| Fuente | Elementos cubiertos |
| --- | --- |
| Roadmap | <puntos de la fase> |
| Backlog | <VIA-XXX o "Sin identificador existente"> |
| Requisitos | <RF, reglas o documentos relacionados> |

## Fuera de alcance

- <funcionalidad reservada para otra fase>

## Riesgos y decisiones

| Tipo | Descripción | Mitigación o decisión requerida |
| --- | --- | --- |
| Riesgo | <riesgo concreto> | <acción> |

## Hito 1 — <resultado demostrable>

### Sprint 1.1 — <incremento verificable>

**Objetivo:** <resultado del sprint>

**Alcance**

- [ ] <entregable>

**Tareas**

- [ ] `<VIA-XXX>` <tarea ordenada y concreta>

**Criterios de aceptación**

- [ ] CA-1.1.1 — <comportamiento observable>

**Pruebas**

- [ ] P-1.1.1 — Unitarias: <caso o "No aplica" justificado>
- [ ] P-1.1.2 — Integración: <caso o "No aplica" justificado>
- [ ] P-1.1.3 — E2E: <flujo o "No aplica" justificado>
- [ ] P-1.1.4 — Seguridad/RLS: <permiso o "No aplica" justificado>

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
| AAAA-MM-DD | 1.1 | Pendiente | — | — |
```

Repite los bloques de hito y sprint tantas veces como sea necesario, sin crear sprints vacíos ni duplicar trabajo.

## Validación de salida

Antes de terminar:

1. Confirma que la ruta sigue `docs/fases/faseNN.md` y que `NN` tiene dos dígitos.
2. Confirma que el archivo no existía previamente.
3. Comprueba que están todas las secciones obligatorias.
4. Comprueba trazabilidad completa entre roadmap, backlog, criterios y pruebas.
5. Resume la fase creada, sus hitos, bloqueos y primer sprint listo para ejecutar.