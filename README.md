# Class Connect API Gateway

Este es un API Gateway construido con Zuplo que incluye autenticación Firebase, validación de usuarios y enriquecimiento automático de respuestas usando **policies**.

## Configuración

### 1. Variables de Entorno

Necesitas configurar las siguientes variables de entorno para que el middleware de autenticación funcione:

```bash
FIREBASE_PROJECT_ID=your-firebase-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nyour-private-key-here\n-----END PRIVATE KEY-----"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com
```

### 2. Obtener las Credenciales de Firebase

1. Ve a la [Consola de Firebase](https://console.firebase.google.com/)
2. Selecciona tu proyecto
3. Ve a **Configuración del proyecto** > **Cuentas de servicio**
4. Haz clic en **Generar nueva clave privada**
5. Descarga el archivo JSON
6. Extrae los valores necesarios:
   - `project_id` → `FIREBASE_PROJECT_ID`
   - `private_key` → `FIREBASE_PRIVATE_KEY`
   - `client_email` → `FIREBASE_CLIENT_EMAIL`

## 🔒 **Usando la Policy de Autenticación**

### Policy: `firebase-auth-simple` (Recomendada)

La policy `firebase-auth-simple` (definida en `modules/firebase-auth-policy-simple.ts`) implementa:

- **Verificación de Token Firebase**: Extrae y valida el token Bearer del header Authorization
- **Consulta de Usuario**: Llama al servicio de usuarios para obtener la información del usuario
- **Validación de Bloqueo**: Verifica si el usuario está bloqueado y deniega el acceso si es necesario
- **Context de Usuario**: Agrega la información del usuario al `request.user` para que esté disponible en los endpoints
- **Sin dependencias**: Usa solo APIs nativas, no requiere `firebase-admin`

## 🚀 **Enriquecimiento Automático de Respuestas**

### Policy: `response-enrichment`

La policy `response-enrichment` (definida en `modules/response-enrichment-policy.ts`) enriquece automáticamente las respuestas JSON con información de usuarios y cursos.

#### ¿Qué hace?

1. **Intercepta respuestas**: Se ejecuta después de que tu endpoint responde (outbound policy)
2. **Extrae IDs**: Busca campos específicos en el JSON de respuesta que contengan IDs de usuarios
3. **Consulta servicios**: Hace llamadas en batch a microservicios para obtener información de usuarios y cursos
4. **Inyecta datos**: Agrega un array `user_info` con todos los usuarios únicos y títulos de cursos

#### Campos que procesa:

**IDs de Usuarios** que se incluyen en el array `user_info`:
- `teacher_id`, `teacher_uuid`, `aux_teacher_id`
- `student_id`, `student_uuid`, `author_id`
- `teacher_ids`, `aux_teacher_ids`, `students_ids` (arrays)

**IDs de Cursos** → **Títulos correspondientes**:
- `course_id` → `course_title`

#### Ejemplo de transformación:

**Antes del enriquecimiento**:
```json
{
  "course": {
    "course_id": "course-123",
    "teacher_id": "user-456",
    "students_ids": ["user-001", "user-002"]
  },
  "post": {
    "author_id": "user-789",
    "content": "Mi publicación"
  }
}
```

**Después del enriquecimiento**:
```json
{
  "course": {
    "course_id": "course-123",
    "course_title": "Matemáticas Avanzadas",
    "teacher_id": "user-456",
    "students_ids": ["user-001", "user-002"]
  },
  "post": {
    "author_id": "user-789",
    "content": "Mi publicación"
  },
  "user_info": [
    {
      "user_id": "user-456",
      "name": "Prof. Juan Pérez",
      "email": "juan.perez@university.edu"
    },
    {
      "user_id": "user-001",
      "name": "Ana García",
      "email": "ana@student.edu"
    },
    {
      "user_id": "user-002",
      "name": "Carlos López",
      "email": "carlos@student.edu"
    },
    {
      "user_id": "user-789",
      "name": "María Silva",
      "email": "maria@example.com"
    }
  ]
}
```

#### Servicios que consulta:

1. **Users Service**: `https://users-service-production-968d.up.railway.app/users/batch`
   - Método: POST
   - Body: `{"user_ids": ["id1", "id2", ...]}`
   - Incluye el token de autorización del request original

2. **Courses Service**: `https://courses-service-production.up.railway.app/courses/{id}`
   - Método: GET

### Cómo aplicar las policies:

#### En el Editor Web de Zuplo:
1. Ve a la configuración de tu ruta
2. **Inbound Policies**: Agrega `firebase-auth-simple` para autenticación
3. **Outbound Policies**: Agrega `response-enrichment` para enriquecimiento
4. ¡Listo! Tu endpoint estará protegido y sus respuestas enriquecidas

#### Ejemplo de configuración en `routes.oas.json`:
```json
{
  "paths": {
    "/api/courses": {
      "get": {
        "summary": "Get courses with enriched data",
        "x-zuplo-policies": [
          {
            "name": "firebase-auth-simple"
          }
        ],
        "x-zuplo-route": {
          "corsPolicy": "custom-cors",
          "handler": {
            "export": "default",
            "module": "$import(./modules/your-endpoint)"
          },
          "policies": {
            "outbound": [
              {
                "name": "response-enrichment"
              }
            ]
          }
        }
      }
    }
  }
}
```

### Acceso a la información del usuario:

En tus endpoints protegidos, puedes acceder a la información del usuario:

```typescript
export default async function (request: ZuploRequest, context: ZuploContext) {
  const user = (request as any).user;
  
  // user.sub = Firebase UID
  // user.data.is_blocked = Estado de bloqueo
  // user.data.userData = Información completa del usuario
  
  return new Response(JSON.stringify({
    message: `Hello, ${user.sub}!`,
    userBlocked: user.data.is_blocked
  }));
}
```

### 4. Uso

Las policies esperan requests con el siguiente header:

```
Authorization: Bearer <firebase-id-token>
```

Y responde con:
- **Continúa al endpoint**: Usuario autenticado y no bloqueado, respuesta enriquecida
- **401**: Token inválido o faltante
- **403**: Usuario bloqueado
- **500**: Error del servidor

## ✅ **Ventajas del Sistema de Policies:**

1. **Reutilizable**: Una policy para todos los endpoints que la necesiten
2. **Modular**: Lógica separada por responsabilidad
3. **Performance**: Optimizado con llamadas en batch y paralelas
4. **Resiliente**: Si falla el enriquecimiento, la respuesta original se mantiene
5. **Configurable**: Puedes habilitar/deshabilitar funcionalidades por policy
6. **Automático**: Una vez configurado, funciona transparentemente
7. **Eficiente**: Un solo array `user_info` evita duplicación de datos

## 🔧 **Configuración de Response Enrichment Policy:**

```json
{
  "name": "response-enrichment",
  "options": {
    "enabled": true,
    "enableUserEnrichment": true,
    "enableCourseEnrichment": true,
    "forwardAuthToken": true,
    "includeAuthenticatedUser": true
  }
}
```

## Archivos Importantes

### Autenticación:
- `modules/firebase-auth-policy-simple.ts`: **Policy de autenticación principal**
- `modules/protected-endpoint.ts`: Ejemplo de endpoint protegido

### Enriquecimiento:
- `modules/response-enrichment-policy.ts`: **Policy principal de enriquecimiento**
- `modules/utils/user-service.ts`: Servicio para consultar usuarios
- `modules/utils/course-service.ts`: Servicio para consultar cursos
- `modules/utils/body-enricher.ts`: Lógica de procesamiento de datos
- `modules/example-enriched-endpoint.ts`: Ejemplo de endpoint con enriquecimiento

### Configuración:
- `config/policies.json`: Configuración de policies disponibles
- `config/routes.oas.json`: Configuración de rutas y policies aplicadas

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the
result.

You can start editing the API by modifying `config/routes.oas.json`. The dev
server will automatically reload the API with your changes.

## Learn More

To learn more about Zuplo, you can visit the
[Zuplo documentation](https://zuplo.com/docs).

To connect with the community join [Discord](https://discord.zuplo.com).
