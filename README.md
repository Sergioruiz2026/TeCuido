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
