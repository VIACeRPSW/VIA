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
  UPDATE -> propietario o moderador/admin
  DELETE -> propietario o moderador/admin
```

``` text
comments:
  INSERT -> usuario autenticado
  DELETE -> autor o moderador/admin
```

``` text
likes:
  INSERT -> usuario autenticado
  DELETE -> propietario del like
```

## 6. Storage

Buckets iniciales:

``` text
avatars
posts
community-images
```

Las políticas deberán impedir que un usuario modifique archivos que no
le corresponden.

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
