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

Una funcionalidad no se considera terminada si solo funciona en el caso
exitoso. Deben probarse también errores, permisos y datos inválidos.
