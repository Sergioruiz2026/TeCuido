# TeCuido

Aplicación móvil Android basada en las pantallas HTML de TeCuido y el backend Node.js de `server/`.

## Preparar el entorno

Se requiere:

- Node.js 20 o superior
- Java JDK 17
- Android Studio con Android SDK instalado

Instalar las dependencias:

```powershell
npm install
```

## Ejecutar en Android

La primera vez, generar la plataforma Android:

```powershell
npx cap add android
```

Sincronizar cambios web:

```powershell
npm run android:sync
```

Abrir el proyecto en Android Studio:

```powershell
npm run android:open
```

Crear un APK de prueba:

```powershell
npm run android:debug
```

El archivo se genera en `android/app/build/outputs/apk/debug/app-debug.apk`.

Para Google Play se debe configurar firma y generar un Android App Bundle:

```powershell
npm run android:release
```

## Conectar el backend

La API se ejecuta desde `server/`:

```powershell
npm run server:start
```

La aplicación móvil usa `app/config.js`. Para el emulador Android se deja `10.0.2.2`, que apunta al computador anfitrión. En un teléfono físico cambia esa dirección por la IP local del computador. Antes de producción, reemplázala por una URL HTTPS pública.

El token de Uber debe permanecer en las variables de entorno del servidor; nunca debe incluirse en el APK.

El acceso HTTP sin cifrar está habilitado únicamente en el manifiesto del build `debug` para poder conectar con un servidor local. El build `release` requiere una API HTTPS.

### Desplegar gratis en Render

1. Sube los cambios del repositorio a GitHub.
2. En Render, crea un **Blueprint** y conecta el repositorio `Sergioruiz2026/TeCuido`.
3. Render leerá `render.yaml` y propondrá crear `tecuido-api` en el plan gratuito.
4. Si usas Uber, introduce `UBER_ACCESS_TOKEN` como secreto en el panel de Render; no lo guardes en GitHub.
5. Tras el primer despliegue, comprueba `https://<servicio>.onrender.com/health` y copia el origen HTTPS asignado.

El plan gratuito puede suspender el servicio por inactividad. El backend actual guarda usuarios, sesiones y fichas médicas solo en memoria: los datos se pierden al reiniciar o suspender el servicio. Además, `/api/medical/access` no autentica ni valida que quien consulta esté autorizado para ver la ficha. No uses datos médicos reales hasta conectar almacenamiento persistente y corregir ese control de acceso, además de completar la revisión de seguridad y privacidad.

### Compilar release con API HTTPS

En PowerShell, configura la URL de Render para esta sesión y crea una clave de firma:

```powershell
$env:TECUIDO_API_URL = 'https://<servicio>.onrender.com'
.\scripts\create-android-keystore.ps1
```

El script solicita la contraseña interactivamente y crea `android/app/tecuido-release.keystore`. Guárdalo y respalda la clave de forma segura: no se puede sustituir para actualizar una aplicación ya publicada.

Antes de compilar, establece las credenciales de firma solo en el entorno local:

```powershell
npm run android:release:prepare
```

En Android Studio selecciona **Build > Generate Signed Bundle / APK**, elige **Android App Bundle** para Google Play o **APK** para distribución directa, y selecciona el keystore creado. El asistente generará el archivo firmado en `android/app/release/` o `android/app/build/outputs/`. No compartas ni confirmes el keystore o sus contraseñas.
