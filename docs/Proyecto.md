# **Arquitectura y Wireframes \- VIA (Versión MVP)**

## **1\. Mapa de Navegación Simplificado**

```
[ Sistema VIA - MVP ]
├── 1. Splash / Bienvenida
├── 2. Inicio de Sesión / Registro
├── 3. Home / Feed Principal (Enfocado en publicaciones y hashtags)
├── 4. Crear / Publicar Imagen (CRUD básico)
├── 5. Vista Individual de Posteo (Solo lectura / Hashtags)
├── 6. Búsqueda y Filtro por Hashtags
├── 7. Perfil de Usuario (Mis publicaciones)
└── 8. Panel de Administración / Moderación (Gestión básica)
```

## **2\. Esquema de Pantallas en Texto (Wireframes)**

### **Pantalla 1: Splash / Bienvenida (**/**)**

Presenta la identidad de marca, el concepto central y los accesos principales.

```
+-----------------------------------------------------------------------------------+
| VIA⁺                                                                              |
| Ideas que inspiran aprendizaje.                                                  |
|                                                                                   |
| [ Ilustración conceptual: Mente + Imágenes / Conocimiento ]                      |
|                                                                                  |
| Red social educativa donde estudiantes y docentes crean y comparten               |
| imágenes generadas con IA.                                                        |
|                                                                                   |
|                           [ Iniciar sesión ]                                      |
|                           [ Crear cuenta ]                                        |
+--------------------------------------------------------------------+
```

### 

### 

### 

### 

### 

### 

### 

### 

### 

### **Pantalla 2: Inicio de Sesión y Registro (**/login **y** /register**)**

Formularios para autenticación y selección de rol básico (Estudiante / Docente).

```
+-----------------------------------------------------------------------------------+
| VIA⁺                                                                              |
| Inicia sesión en tu cuenta                                                        |
|                                                                                   |
| Correo electrónico o usuario: [                                                 ] |
| Contraseña:                  [                                                 ] |
| Rol:                         (o) Estudiante   ( ) Docente                     |
|                                                                                   |
|                           [ Iniciar sesión ]                                      |
|                                                                                   |
| ¿No tienes cuenta? [ Registrarse ]                                                |
+--------------------------------------------------------------------+
```

### 

### **Pantalla 3: Home / Feed Principal (**/home**)**

Muestra las publicaciones recientes. Cada tarjeta incluye la imagen, el título, el autor y los **hashtags** asociados para navegación rápida.

```
+--------------------------------------------------------------------+
|  VIA⁺   [ Q Buscar por #hashtag, tema, usuario... ]                   (+) Crear   |
+-----------------------------------------------------------------------------------+
| HASHTAGS DESTACADOS:  [#Todos] [#Biologia] [#Historia] [#Fisica] [#Matematica]   |
+-----------------------------------------------------------------------------------+
| FEED DE PUBLICACIONES                                                             |
|                                                                                   |
| +------------------------------------------------------------------+ |
| | @Docente_Maria • Comunidad: Biología                                          | |
| | Título: Célula Eucariota y sus Órganos                                       | |
| |                                                                               | |
| | +---------------------------------------------------------------------------+ | |
| | |                                                                           | | |
| | |                    [ IMAGEN GENERADA POR IA / INFOGRAFÍA ]                | | |
| | |                                                                           | | |
| | +----------------------------------------------------------------+ | |
| |                                                                               | |
| | Hashtags: [#Biologia] [#Celula] [#Secundaria] [#Infografia]                    | |
| +-------------------------------------------------------------------------------+ |
|                                                                                   |
| +-------------------------------------------------------------------------------+ |
| | @SofiProfe • Comunidad: Historia                                             | |
| | Título: Línea de tiempo de la Revolución Industrial                          | |
| | ...                                                                           | |
| +-------------------------------------------------------------------------------+ |
+-----------------------------------------------------------------------------------+
```

### 

### **Pantalla 4: Crear / Publicar Imagen (**/crear**)**

Formulario para crear y subir la imagen educativa, asignar títulos, descripciones y definir los **hashtags de filtro**.

```
+-----------------------------------------------------------------------------------+
| < Volver                                                       NUEVA PUBLICACIÓN  |
+-----------------------------------------------------------------------------------+
| 1. CARGAR IMAGEN                                                                  |
| +-------------------------------------------------------------------------------+ |
| |                                                                               | |
| |                [ Arrastra tu imagen o haz clic para subir ]                   | |
| |                                                                               | |
| +-------------------------------------------------------------------------------+ |
|                                                                                   |
| 2. DATOS DE LA PUBLICACIÓN                                                        |
| Título:        [ Ej: Fotosíntesis en una infografía                             ] |
| Descripción:   [ Breve explicación del contenido visual...                        ] |
| Comunidad:     [ Seleccionar materia/comunidad ∨ ]                                |
|                                                                                   |
| 3. CATEGORIZACIÓN POR HASHTAGS (Requerido para filtros)                           |
| Hashtags:      [ #Biologia #Fotosintesis #Primaria                            ] |
|                (Separa las etiquetas con un espacio o coma)                      |
|                                                                                   |
|                                                               [ Publicar Imagen ] |
+-----------------------------------------------------------------------------------+
```

### 

### **Pantalla 5: Vista de Imagen / Posteo (**/post/:id**)**

Pantalla limpia enfocada exclusivamente en apreciar la imagen en detalle, leer la descripción y hacer clic en sus hashtags para filtrar.

```
+-----------------------------------------------------------------------------------+
| < Volver al Feed                                                                  |
+-----------------------------------------------------------------------------------+
| +------------------------------------------+ DETALLES DE LA PUBLICACIÓN          |
| |                                          |                                      |
| |                                          | Autor: @LuciaEstu                    |
| |                                          | Comunidad: Historia                  |
| |                                          |                                      |
| |        [ IMAGEN A TAMAÑO COMPLETO ]      | Título:                              |
| |                                          | Línea de tiempo de la Revolución     |
| |                                          | Industrial                           |
| |                                          |                                      |
| |                                          | Descripción:                         |
| |                                          | Resumen gráfico de los principales   |
| |                                          | hitos históricos entre 1760 y 1970.   |
| |                                          |                                      |
| | [ 🔍 Ver en alta resolución ]           | HASHTAGS ASOCIADOS:                  |
| |                                          | [#Historia] [#RevolucionIndustrial]  |
| +------------------------------------------+ [#Infografia]                        |
+-----------------------------------------------------------------------------------+
```

### 

### **Pantalla 6: Búsqueda y Filtros por Hashtags (**/buscar**)**

Motor de búsqueda y exploración basado en hashtags para organizar los temas de aprendizaje.

```
+-----------------------------------------------------------------------------------+
| VIA⁺   [ Q #Biologia                                                            ] |
+-----------------------------------------------------------------------------------+
| Resultados para el hashtag: #Biologia (24 publicaciones encontradas)              |
|                                                                                   |
| FILTRAR POR COMUNIDAD: [Todas ∨]    ORDENAR: [Más recientes ∨]                   |
|                                                                                   |
| +-----------------------+  +-----------------------+  +-----------------------+   |
| | [ Imagen ]            |  | [ Imagen ]            |  | [ Imagen ]            |   |
| | Célula Eucariota      |  | La Fotosíntesis       |  | Cadena Alimenticia    |   |
| | Por: @Docente_Maria   |  | Por: @SofiProfe       |  | Por: @CarlosEdu       |   |
| | #Biologia #Celula     |  | #Biologia #Plantas    |  | #Biologia #Ecosistema |   |
| +-----------------------+  +-----------------------+  +-----------------------+   |
+-----------------------------------------------------------------------------------+
```

### 

### 

### **Pantalla 7: Perfil de Usuario (**/perfil**)**

Muestra la información básica del usuario (estudiante o docente) y la galería de todas las imágenes que ha publicado.

```
+-----------------------------------------------------------------------------------+
| [ Avatar ]  @SofiProfe (Docente)                                                  |
|             "Apasionada por la tecnología y la educación visual."                 |
|             Publicaciones realizadas: 12                                          |
|             [ Editar Perfil ]                                                     |
+-----------------------------------------------------------------------------------+
| MIS PUBLICACIONES                                                                 |
|                                                                                   |
| +-----------------------+  +-----------------------+  +-----------------------+   |
| | [ Imagen ]            |  | [ Imagen ]            |  | [ Imagen ]            |   |
| | Mapa mental ADN       |  | La Energía            |  | Geometría Plana       |   |
| | #Biologia #ADN        |  | #Fisica #Energia      |  | #Matematica #Formulas |   |
| | [Editar] [Eliminar]   |  | [Editar] [Eliminar]   |  | [Editar] [Eliminar]   |   |
| +-----------------------+  +-----------------------+  +-----------------------+   |
+-----------------------------------------------------------------------------------+
```

### **Pantalla 8: Panel de Administración / Moderación (**/admin**)**

Permite a los administradores y moderadores gestionar el contenido publicado para asegurar que cumpla con las normas educativas.

```
+-----------------------------------------------------------------------------------+
| PANEL DE ADMINISTRACIÓN / MODERACIÓN                                              |
+-----------------------------------------------------------------------------------+
| Módulos: [ Gestión de Publicaciones ] [ Usuarios ]                               |
+-----------------------------------------------------------------------------------+
| LISTA DE PUBLICACIONES RECIENTES                                                  |
|                                                                                   |
| ID   | Título               | Autor        | Hashtags           | Acciones        |
| ---- | -------------------- | ------------ | ------------------ | --------------- |
| #102 | Célula Eucariota     | @MariaDoc    | #Biologia #Celula  | [Ver] [Eliminar]|
| #103 | Revolución Industrial| @LuciaEstu   | #Historia          | [Ver] [Eliminar]|
| #104 | Prueba Generada      | @UserTest    | #SinTag            | [Ver] [Eliminar]|
+-----------------------------------------------------------------------------------+
```

## 

## **3\. Resumen de Funcionalidades del MVP**

1. **Gestión de Usuarios:** Registro, inicio de sesión y asignación de rol básico (Estudiante / Docente).  
2. **CRUD de Publicaciones:**  
   * **Crear:** Carga de imagen, título, descripción y etiquetas/hashtags.  
   * **Leer:** Feed general y vista detallada de la imagen.  
   * **Editar / Eliminar:** Disponible únicamente para el autor de la publicación o los administradores.  
3. **Filtro y Categorización por Hashtags:**  
   * Barra de búsqueda por \#hashtag.  
   * Clic directo en etiquetas desde cualquier publicación para filtrar contenidos similares.  
4. **Moderación Búsqueda BÁSICA (Admin):** Panel para eliminar imágenes o contenido inapropiado.

