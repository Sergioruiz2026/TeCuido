# Cómo compartir TeCuido sin Play Store

## 1. Antes de compartir (una sola vez)
1. **Supabase → Authentication → Emails**: el correo integrado tiene un límite muy bajo de envíos.
   Si muchas personas se registran, no les llegará el correo de confirmación. Opciones:
   - Configurar SMTP propio gratis (Resend, Brevo), o
   - Desactivar "Confirm email" (más simple, pero acepta correos falsos).
2. **Render (plan gratis) se duerme** y el primer login puede tardar ~1 minuto.
   Crea un monitor gratis en UptimeRobot que llame a `https://tecuido-api.onrender.com/health` cada 5 min.
3. Prueba el APK en **un teléfono real, con datos móviles** (no solo en el emulador).

## 2. Firma (nunca pierdas este archivo)
- Usa SIEMPRE el mismo keystore: si cambia, nadie podrá actualizar la app sin desinstalarla (y perderá sus datos locales).
- Respáldalo (pendrive + gestor de contraseñas). No lo subas a GitHub.
- Copia `android/keystore.properties.example` a `android/keystore.properties` y completa tus datos.
  Está en el `.gitignore`.

## 3. Compilar
**Local (Windows):**
```powershell
$env:TECUIDO_API_URL = 'https://tecuido-api.onrender.com'
node scripts/configure-api.js --release
npx cap sync android
cd android
.\gradlew.bat assembleRelease
```
APK en `android/app/build/outputs/apk/release/app-release.apk`.
> No ejecutes `npm run web:sync` / `android:release:prepare`: buscan una carpeta que ya no existe.

**Automático (GitHub Actions):** agrega estos *Secrets* en GitHub → Settings → Secrets → Actions:
`TECUIDO_API_URL`, `KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.
Para obtener `KEYSTORE_BASE64` en PowerShell:
`[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\tecuido-release.jks"))`
Luego: `git tag v1.0.1 && git push --tags` y el APK aparece en **Releases**.

## 4. Distribuir
- Sube el APK a **GitHub Releases** (gratis, enlace estable):
  `https://github.com/Sergioruiz2026/TeCuido/releases/latest`
- Comparte ese enlace por WhatsApp/web. En Android se instala así:
  1. Descargar el APK.
  2. Aceptar "Permitir instalar apps de esta fuente" para el navegador/gestor de archivos.
  3. Instalar. (Puede aparecer aviso de Play Protect: "Instalar de todos modos".)
- En cada actualización **sube `versionCode`** en `android/app/build.gradle` (1 → 2 → 3…) y `versionName`.

## 5. Obligatorio si hay datos de salud de terceros
- Página simple con política de privacidad (qué datos, dónde se guardan: Supabase; cómo borrarlos).
- Aviso visible: "TeCuido no reemplaza indicación médica".
- Mecanismo para eliminar cuenta/datos.
