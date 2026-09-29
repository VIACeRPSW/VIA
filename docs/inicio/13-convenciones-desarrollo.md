# VIA --- Convenciones de desarrollo

## 1. Lenguaje

El proyecto utilizará TypeScript.

## 2. Componentes

Los componentes React deberán utilizar nombres en PascalCase.

``` text
PostCard.tsx
LikeButton.tsx
CommentForm.tsx
```

## 3. Funciones

Las funciones deberán utilizar nombres descriptivos en camelCase.

``` text
createPost()
deleteComment()
toggleLike()
```

## 4. Variables

Usar nombres claros.

Evitar:

``` text
x
data2
foo
```

Preferir:

``` text
post
currentUser
communityId
```

## 5. Base de datos

Los nombres de tablas se mantendrán en plural y snake_case.

``` text
posts
community_members
user_badges
```

## 6. Git

Ramas sugeridas:

``` text
main
develop
feature/*
fix/*
refactor/*
```

## 7. Commits

Formato:

``` text
feat: agregar creación de publicaciones
fix: corregir permisos de edición
refactor: separar componente de publicación
docs: actualizar ERS
test: agregar pruebas de likes
```

## 8. Pull Requests

Cada PR deberá indicar:

-   Qué cambia.
-   Por qué.
-   Cómo probarlo.
-   Capturas cuando cambie UI.
-   Impacto en base de datos.
-   Impacto en seguridad.

## 9. Código

No duplicar lógica cuando pueda reutilizarse.

La lógica de negocio no debe quedar mezclada innecesariamente con la
presentación.

## 10. Variables sensibles

Nunca colocar credenciales en:

-   Código fuente.
-   Commits.
-   Issues.
-   Capturas.
-   Documentación pública.
