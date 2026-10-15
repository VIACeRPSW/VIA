# VIA --- Seguridad y autorización

## 1. Autenticación

Clerk será responsable de:

-   Registro.
-   Login.
-   Logout.
-   Sesiones.
-   Identidad del usuario.

## 2. Autorización

La aplicación distinguirá:

``` text
user
moderator
admin
```

## 3. Principio de mínimo privilegio

Cada rol tendrá únicamente los permisos necesarios.

### Usuario

Puede modificar recursos propios.

### Moderador

Puede moderar recursos según el alcance asignado.

### Administrador

Puede gestionar el sistema.

### Matriz de perfiles

| Operación | `user` | `moderator` | `admin` |
| --- | --- | --- | --- |
| Leer perfiles privados | Solo el propio | El propio y perfiles `user` | Todos |
| Editar datos ordinarios | Solo el propio | El propio y perfiles `user` | Todos |
| Cambiar roles | No | No | Sí |
| Eliminar perfiles | No | Solo perfiles `user` | Todos, excepto eliminar el último `admin` |
| Crear perfiles | El propio con rol inicial `user` | El propio con rol inicial `user` | El propio con rol inicial `user` |

Los campos `id` y `clerk_user_id` son inmutables para todos los roles. Los
campos ordinarios editables son `username`, `display_name`, `bio` y
`avatar_url`. Un moderador nunca puede actuar sobre otro moderador ni sobre un
administrador, y tampoco puede promover usuarios. Solo un administrador puede
cambiar roles; la base de datos deberá impedir que se elimine o degrade el
último administrador.

El primer administrador se asignará mediante una operación administrativa
directa y auditada en PostgreSQL. La interfaz de gestión de roles y usuarios
permanece reservada para la fase de administración.

## 4. Protección de rutas

Las rutas privadas deberán requerir autenticación.

Las rutas administrativas deberán comprobar el rol.

## 5. Protección de datos

Supabase deberá utilizar Row Level Security.

Ejemplos conceptuales:

``` text
posts:
  SELECT -> contenido público permitido
  INSERT -> usuario autenticado
  UPDATE -> propietario (todos los roles en Fase 3)
  DELETE -> propietario (todos los roles en Fase 3)
```

En Fase 3 no se permite a moderadores ni administradores modificar
publicaciones ajenas. Los permisos de gestión ajena se incorporan y prueban
en Fase 7; la jerarquía existente de perfiles no concede privilegios sobre
publicaciones ni objetos Storage.

``` text
comments:
  SELECT -> proyección pública de comentarios de posts públicos
  INSERT -> usuario autenticado con perfil, autor derivado
  DELETE -> solo autor, todos los roles en Fase 4
```

``` text
likes:
  SELECT -> solo relación propia; agregados públicos por RPC acotada
  INSERT -> usuario autenticado con perfil, sobre post público
  DELETE -> propietario del like
```

En Fase 4, autor del post, moderador y administrador no pueden borrar
comentarios o likes ajenos. La moderación se reserva a Fase 7. Las
mutaciones sociales derivan al actor del JWT y no aceptan propietario o
rol enviados por cliente. Un anónimo o usuario sin perfil solo puede leer
agregados/comentarios públicos y compartir el enlace.

Seguir exige sesión/perfil, unicidad y destino distinto del actor. La
lectura pública se limita a conteos; estado personal solo para el titular,
sin listas de likes ni seguidores. Borrar un post elimina atómicamente
sus likes y comentarios, no perfiles ni recursos ajenos, conservando el
journal de limpieza de imágenes. Las respuestas personales no se
almacenan en caché compartida y se descartan al cambiar de sesión.

## 6. Storage

Buckets iniciales:

``` text
avatars
posts
community-images
```

Las políticas deberán impedir que un usuario modifique archivos que no
le corresponden.

### Contrato de avatares implementado

- `avatars` es público para la lectura de imágenes; el listado de metadatos
  y el registro de limpieza no dan acceso a datos ajenos ni a anónimos.
- La aplicación admite JPEG, PNG y WebP estáticos de hasta 2 MiB y 4096
  píxeles por lado. Sharp verifica el contenido y normaliza a WebP de hasta
  512 × 512 sin metadatos. Storage admite únicamente WebP, hasta 2097152 bytes.
- Las rutas son `SHA256(sub)/UUID.webp`: no incluyen el identificador Clerk
  literal. Las acciones generan rutas y URLs; ignoran propietario, ruta,
  referencia y estado previo aportados por el cliente.
- INSERT exige ruta propia, perfil existente y ticket de carga vigente.
  No se permite UPDATE/overwrite. DELETE exige ruta propia y que no sea
  el avatar activo del propietario. Los roles elevados de perfiles no
  amplían los permisos sobre archivos ajenos.
- Una RPC invoker con `search_path` vacío aplica compare-and-swap; el registro
  privado permite compensar y reintentar fallos parciales sin usar
  credenciales administrativas. Los errores se registran de forma redactada.
- Next Image admite solo el origen configurado y la ruta pública del bucket,
  sin redirecciones ni URLs con parámetros. Una retirada no revoca copias
  públicas o cachés ya distribuidas.
- El rollback rechaza objetos, referencias o tareas existentes. Elimina
  recursos de aplicación por SQL y deja la retirada del bucket vacío a
  la API de Storage/panel; nunca desactiva la protección de sus tablas.

### Contrato de imágenes de publicaciones aprobado para Fase 3

- Bucket `posts` privado. Las publicaciones confirmadas y sus imágenes son
  públicas, pero las cargas pendientes solo son accesibles al propietario.
- JPEG, PNG o WebP estáticos de hasta 5 MiB (5242880 bytes), como máximo
  4096 píxeles por eje. Validación real de contenido, rechazo de formatos
  discordantes, animados o vacíos y normalización WebP sin metadatos.
- Objetos inmutables en `SHA256(sub)/UUID.webp`, vinculados a una operación
  propia vigente antes de cargarlos; sin overwrite ni rutas del cliente.
- La lectura del bucket exige publicación confirmada asociada o propiedad
  de la carga pendiente. El anónimo puede solicitar una URL firmada solo
  para el objeto de una publicación pública; no listar cargas privadas.
- Las URLs firmadas duran 60 segundos, se generan al leer y no se guardan
  en metadata, logs ni documentación. No hay caché pública que prolongue
  esa autorización; una retirada impide nuevas firmas y elimina el objeto.
  Una URL emitida puede seguir siendo válida hasta vencer y no se pueden
  revocar copias descargadas. No se usa `service_role` para la entrega.
- La base valida sesión/perfil, propiedad, objeto y operación también en
  llamadas directas. Confirmación, reintentos y limpieza son observables;
  un fallo de borrado físico se presenta como limpieza pendiente.
- Estas son decisiones de contrato, no infraestructura ya aplicada.

## 7. Secretos

Nunca se deben incluir en el repositorio:

-   Secret keys.
-   Tokens privados.
-   Credenciales administrativas.

Se utilizará `.env.local` y las variables de entorno del proveedor de
despliegue.

## 8. Validación

Toda entrada proveniente del usuario deberá validarse en servidor,
aunque también se valide en el cliente.

Validar como mínimo:

-   Campos obligatorios.
-   Longitudes.
-   Formato.
-   Identidad.
-   Permisos.
-   Referencias existentes.
