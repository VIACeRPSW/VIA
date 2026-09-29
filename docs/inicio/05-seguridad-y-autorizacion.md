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
