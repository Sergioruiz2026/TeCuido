const fs = require('node:fs');
const path = require('node:path');

const release = process.argv.includes('--release');
const configuredUrl = process.env.TECUIDO_API_URL;
const apiUrl = configuredUrl || (release ? '' : 'http://10.0.2.2:3000');

if (!apiUrl) {
  console.error('Define TECUIDO_API_URL con la URL HTTPS de la API de Render antes del release.');
  process.exit(1);
}

let parsedUrl;
try {
  parsedUrl = new URL(apiUrl);
} catch {
  console.error('TECUIDO_API_URL debe ser una URL absoluta, por ejemplo https://tecuido-api.onrender.com.');
  process.exit(1);
}

if (!['http:', 'https:'].includes(parsedUrl.protocol) ||
    parsedUrl.username || parsedUrl.password ||
    (parsedUrl.pathname !== '/' && parsedUrl.pathname !== '') ||
    parsedUrl.search || parsedUrl.hash) {
  console.error('TECUIDO_API_URL debe contener solo el origen de la API, sin credenciales, ruta, query ni fragmento.');
  process.exit(1);
}

if (release && parsedUrl.protocol !== 'https:') {
  console.error('El build release exige una dirección HTTPS para la API.');
  process.exit(1);
}

const normalizedUrl = parsedUrl.origin;
const config = `window.TECUIDO_API_URL = '${normalizedUrl}';\n`;
const configPath = path.join(__dirname, '..', 'app', 'config.js');
fs.writeFileSync(configPath, config, 'utf8');
console.log(`API configurada para ${release ? 'release' : 'debug'}: ${normalizedUrl}`);
