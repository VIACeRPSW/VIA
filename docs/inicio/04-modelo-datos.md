# VIA --- Modelo de datos

## 1. Principio

Supabase PostgreSQL almacenará los datos propios de VIA. Clerk
administrará la identidad externa del usuario.

## 2. Entidades

``` text
profiles
posts
categories
communities
community_members
comments
likes
shares
follows
badges
user_badges
reports
```

## 3. profiles

``` text
profiles
---------
id
clerk_user_id
username
display_name
bio
avatar_url
role
created_at
updated_at
```

### Reglas

-   `clerk_user_id` es único.
-   `username` es único.
-   `role` pertenece al conjunto `user`, `moderator`, `admin`.
-   `role` tiene `user` como valor inicial y no puede modificarse mediante el
	acceso ordinario del usuario.

## 4. posts

``` text
posts
-----
id
user_id
community_id
category_id
title
description
image_url
prompt
status
created_at
updated_at
```

Relaciones:

-   `user_id -> profiles.id`
-   `community_id -> communities.id`
-   `category_id -> categories.id`

## 5. categories

``` text
categories
----------
id
name
description
created_at
```

## 6. communities

``` text
communities
-----------
id
name
description
image_url
creator_id
created_at
```

## 7. community_members

``` text
community_members
-----------------
id
community_id
user_id
joined_at
```

Restricción:

``` text
UNIQUE(community_id, user_id)
```

## 8. comments

``` text
comments
--------
id
post_id
user_id
content
created_at
updated_at
```

## 9. likes

``` text
likes
-----
id
post_id
user_id
created_at
```

Restricción:

``` text
UNIQUE(post_id, user_id)
```

## 10. shares

``` text
shares
------
id
post_id
user_id
created_at
```

## 11. follows

``` text
follows
-------
id
follower_id
following_id
created_at
```

Restricciones:

``` text
UNIQUE(follower_id, following_id)
follower_id != following_id
```

## 12. badges

``` text
badges
------
id
name
description
icon_url
requirement
created_at
```

## 13. user_badges

``` text
user_badges
-----------
id
user_id
badge_id
earned_at
```

## 14. reports

``` text
reports
-------
id
reporter_id
post_id
comment_id
reported_user_id
reason
status
reviewed_by
created_at
reviewed_at
```

## 15. Relaciones

``` text
profiles 1 ---- N posts
profiles 1 ---- N comments
profiles N ---- N posts        mediante likes
profiles N ---- N profiles     mediante follows
profiles N ---- N communities  mediante community_members
profiles N ---- N badges       mediante user_badges
posts N ---- 1 categories
posts N ---- 1 communities
posts 1 ---- N comments
posts 1 ---- N likes
posts 1 ---- N shares
```

## 16. Índices iniciales

Se deberán evaluar índices para:

-   `posts.created_at`
-   `posts.category_id`
-   `posts.community_id`
-   `posts.user_id`
-   `comments.post_id`
-   `likes.post_id`
-   `community_members.community_id`
-   `community_members.user_id`
-   `follows.follower_id`
-   `follows.following_id`

Los índices definitivos se ajustarán según las consultas reales del MVP.
