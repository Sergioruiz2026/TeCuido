# API de TeCuido

## Configuración

La API requiere Node.js 20 o posterior y un proyecto Supabase.

1. Crea un proyecto Supabase.
2. En el SQL Editor ejecuta [`supabase/schema.sql`](./supabase/schema.sql).
3. En Render configura `SUPABASE_URL` y `SUPABASE_ANON_KEY` como variables de entorno. En desarrollo, define esas mismas variables en el proceso local; el servidor no carga archivos `.env` automáticamente.
4. Inicia la API:

```powershell
npm start
```

La clave `service_role` no es necesaria ni debe incluirse en Render o en el APK. La API usa la clave pública `anon` junto con el JWT del usuario, y las tablas aplican Row Level Security (RLS) con `auth.uid()`.

## Persistencia y acceso

- Supabase Auth gestiona registro, inicio de sesión, renovación y cierre de sesión.
- Los perfiles médicos, remedios, tomas e citas se guardan en tablas Postgres con RLS por usuario.
- Las tablas `medical_profiles`, `medications`, `appointments` y `medication_doses` se crean con el script de esquema incluido.
- No se guardan credenciales de usuario ni registros en memoria local del servidor.
- `/api/medical/access` permanece deshabilitado (HTTP 503): la lectura pública o para terceros requiere un flujo de autorización específico y auditable.
- No habilites el uso con datos médicos reales hasta revisar obligaciones de privacidad aplicables, controles y copias de seguridad del proyecto Supabase.

## Endpoints

- `GET /health`
- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`
- `GET /api/profile/medical`, `PUT /api/profile/medical`
- `GET|POST /api/medications`
- `PATCH|DELETE /api/medications/:id`
- `POST /api/medications/:id/doses`
- `GET /api/medication-doses?from=<ISO>&to=<ISO>`
- `GET|POST /api/appointments`
- `PATCH|DELETE /api/appointments/:id`
- `POST /api/transport/uber/estimate` y `/api/transport/uber/request`
- `POST /api/medical/access` sigue deshabilitado hasta implementar autorización segura.

Las operaciones personales requieren `Authorization: Bearer <access_token>`. Validación adicional del usuario se aplica en el servidor y RLS en Postgres.

### Uber

Configura `UBER_ACCESS_TOKEN` solo si se habilita la integración y se dispone de las credenciales y permisos requeridos. La confirmación de viajes no está disponible en la app mientras no exista un flujo autorizado y probado.
