# API de transporte de TeCuido

## Configuración

1. Copia `.env.example` como `.env` y configura `PORT` y `UBER_ACCESS_TOKEN`.
2. Usa un token OAuth de usuario emitido por Uber para el usuario que solicitará el viaje.
3. Ejecuta:

```powershell
node src/server.js
```

El backend no lee automáticamente archivos `.env`; configura las variables desde el entorno de ejecución o mediante el gestor de secretos del despliegue.

## Credenciales y datos sensibles

- Las contraseñas se almacenan con `crypto.scrypt`, salt aleatorio y comparación resistente a tiempo. No se guardan ni se recuperan en texto plano.
- El correo se valida en el servidor y debe tener formato real, como `persona@example.com`.
- El servidor de ejemplo almacena usuarios en memoria para desarrollo; al reiniciar se pierden. Antes de producción se debe conectar una base de datos con cifrado en reposo, copias protegidas, rotación de claves y control de acceso.
- No se deben enviar contraseñas ni datos médicos a logs, analítica o el navegador fuera de HTTPS.

## Endpoints

- `GET /health`
- `POST /api/transport/uber/estimate`
- `POST /api/transport/uber/request`

Las rutas de viaje requieren coordenadas, no direcciones libres:

```json
{
  "origin": { "latitude": -33.45, "longitude": -70.66 },
  "destination": { "latitude": -33.42, "longitude": -70.61 },
  "rideType": "assist"
}
```

La confirmación requiere además el `productId` devuelto por la consulta de productos. La aplicación no debe guardar tokens de Uber en el navegador.
