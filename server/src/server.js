const http = require('node:http');
const crypto = require('node:crypto');

const PORT = Number(process.env.PORT || 3000);
const UBER_API_BASE_URL = process.env.UBER_API_BASE_URL || 'https://api.uber.com';
const users = new Map();
const sessions = new Map();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;

function isValidEmail(value) {
  return typeof value === 'string' &&
    value.length <= 254 &&
    EMAIL_PATTERN.test(value.trim());
}

function validatePassword(value) {
  if (typeof value !== 'string' || value.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.';
  }
  if (!/[A-Z]/.test(value) || !/[a-z]/.test(value) || !/\d/.test(value)) {
    return 'La contraseña debe incluir mayúscula, minúscula y número.';
  }
  return null;
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(`${salt}:${derivedKey.toString('hex')}`);
    });
  });
}

async function verifyPassword(password, storedHash) {
  const [salt, expectedHex] = storedHash.split(':');
  const actual = await hashPassword(password, salt);
  return crypto.timingSafeEqual(
    Buffer.from(actual.split(':')[1], 'hex'),
    Buffer.from(expectedHex, 'hex')
  );
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS'
  });
  res.end(JSON.stringify(body));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 32 * 1024) {
        reject(new Error('Request body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function isCoordinate(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function validateLocation(location, name) {
  if (!location || !isCoordinate(location.latitude) || !isCoordinate(location.longitude)) {
    return `${name} requiere latitude y longitude numéricas.`;
  }
  if (location.latitude < -90 || location.latitude > 90) {
    return `${name}.latitude está fuera de rango.`;
  }
  if (location.longitude < -180 || location.longitude > 180) {
    return `${name}.longitude está fuera de rango.`;
  }
  return null;
}

function validateTrip(payload) {
  const originError = validateLocation(payload.origin, 'origin');
  if (originError) return originError;
  const destinationError = validateLocation(payload.destination, 'destination');
  if (destinationError) return destinationError;
  if (payload.rideType && !['uberx', 'comfort', 'assist'].includes(payload.rideType)) {
    return 'rideType no válido.';
  }
  return null;
}

function uberToken() {
  return process.env.UBER_ACCESS_TOKEN || process.env.UBER_SERVER_TOKEN;
}

async function callUber(path, options = {}) {
  const token = uberToken();
  if (!token) {
    const error = new Error('Uber no está configurado en el servidor.');
    error.statusCode = 503;
    throw error;
  }
  const response = await fetch(`${UBER_API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {})
    }
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { message: 'Uber devolvió una respuesta no válida.' };
  }
  if (!response.ok) {
    const error = new Error(body.message || 'Uber rechazó la solicitud.');
    error.statusCode = response.status >= 500 ? 502 : response.status;
    throw error;
  }
  return body;
}

async function estimateTrip(payload) {
  const validationError = validateTrip(payload);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 422;
    throw error;
  }

  const params = new URLSearchParams({
    start_latitude: String(payload.origin.latitude),
    start_longitude: String(payload.origin.longitude),
    end_latitude: String(payload.destination.latitude),
    end_longitude: String(payload.destination.longitude)
  });
  const response = await callUber(`/v1.2/estimates/price?${params}`);
  return {
    provider: 'uber',
    currency: response.prices?.[0]?.currency_code || null,
    price: response.prices?.[0]?.high_estimate || null,
    prices: response.prices || [],
    disclaimer: 'La tarifa y disponibilidad pueden cambiar antes de confirmar.'
  };
}

async function requestTrip(payload) {
  const validationError = validateTrip(payload);
  if (validationError) {
    const error = new Error(validationError);
    error.statusCode = 422;
    throw error;
  }
  if (!payload.productId) {
    const error = new Error('productId es obligatorio para confirmar un viaje.');
    error.statusCode = 422;
    throw error;
  }

  return callUber('/v1.2/requests', {
    method: 'POST',
    body: JSON.stringify({
      product_id: payload.productId,
      start_latitude: payload.origin.latitude,
      start_longitude: payload.origin.longitude,
      end_latitude: payload.destination.latitude,
      end_longitude: payload.destination.longitude
    })
  });
}

async function handler(req, res) {
  if (req.method === 'OPTIONS') return sendJson(res, 204, {});
  if (req.method === 'GET' && req.url === '/health') {
    return sendJson(res, 200, { ok: true, service: 'tecuido-transport-api' });
  }

  const route = new URL(req.url, 'http://localhost').pathname;
  if (req.method !== 'POST' && !(req.method === 'PUT' && route === '/api/profile/medical') &&
      !(req.method === 'GET' && route === '/api/profile/medical')) {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }
  if (req.method === 'POST' && route === '/api/auth/register') {
    try {
      const payload = await readJson(req);
      if (!isValidEmail(payload.email)) {
        return sendJson(res, 422, { error: 'Ingresa un correo real, por ejemplo: nombre@dominio.com.' });
      }
      const passwordError = validatePassword(payload.password);
      if (passwordError) return sendJson(res, 422, { error: passwordError });
      const email = payload.email.trim().toLowerCase();
      if (users.has(email)) return sendJson(res, 409, { error: 'Ese usuario ya existe.' });
      users.set(email, {
        id: crypto.randomUUID(),
        email,
        passwordHash: await hashPassword(payload.password),
        medicalProfile: payload.medicalProfile || {}
      });
      return sendJson(res, 201, { ok: true, message: 'Usuario creado. Completa tu ficha médica.' });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }
  if (req.method === 'POST' && route === '/api/auth/login') {
    try {
      const payload = await readJson(req);
      const email = typeof payload.email === 'string' ? payload.email.trim().toLowerCase() : '';
      const user = users.get(email);
      if (!user || typeof payload.password !== 'string' || !(await verifyPassword(payload.password, user.passwordHash))) {
        return sendJson(res, 401, { error: 'Usuario o clave incorrectos.' });
      }
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, user.id);
      return sendJson(res, 200, { ok: true, token, user: { id: user.id, email: user.email } });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }
  if (req.method === 'PUT' && route === '/api/profile/medical') {
    try {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      const userId = sessions.get(token);
      const user = [...users.values()].find(item => item.id === userId);
      if (!user) return sendJson(res, 401, { error: 'Sesión inválida o vencida.' });
      const payload = await readJson(req);
      user.medicalProfile = {
        fullName: typeof payload.fullName === 'string' ? payload.fullName.trim().slice(0, 120) : '',
        rut: typeof payload.rut === 'string' ? payload.rut.trim().slice(0, 20) : '',
        diabetes: Boolean(payload.diabetes),
        hypertension: Boolean(payload.hypertension),
        allergies: typeof payload.allergies === 'string' ? payload.allergies.trim().slice(0, 500) : '',
        medications: typeof payload.medications === 'string' ? payload.medications.trim().slice(0, 500) : '',
        bloodType: typeof payload.bloodType === 'string' ? payload.bloodType.trim().slice(0, 10) : '',
        emergencyContact: typeof payload.emergencyContact === 'string' ? payload.emergencyContact.trim().slice(0, 100) : ''
      };
      return sendJson(res, 200, { ok: true, medicalProfile: user.medicalProfile });
    } catch (error) {
      return sendJson(res, 400, { error: error.message });
    }
  }
  if (req.method === 'GET' && route === '/api/profile/medical') {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const userId = sessions.get(token);
    const user = [...users.values()].find(item => item.id === userId);
    if (!user) return sendJson(res, 401, { error: 'Sesión inválida o vencida.' });
    return sendJson(res, 200, { medicalProfile: user.medicalProfile || {} });
  }
  if (req.method === 'POST' && route === '/api/medical/access') {
    return sendJson(res, 503, {
      error: 'El acceso público a fichas médicas está temporalmente deshabilitado hasta implementar autorización segura.'
    });
  }
  if (!['/api/transport/uber/estimate', '/api/transport/uber/request'].includes(route)) {
    return sendJson(res, 404, { error: 'Ruta no encontrada.' });
  }

  try {
    const payload = await readJson(req);
    const result = route.endsWith('/estimate')
      ? await estimateTrip(payload)
      : await requestTrip(payload);
    return sendJson(res, 200, result);
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode : 500;
    if (status >= 500) console.error(`[transport] ${error.message}`);
    return sendJson(res, status, { error: error.message });
  }
}

const server = http.createServer(handler);
if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`TeCuido transport API listening on port ${PORT}`);
  });
}

module.exports = {
  handler,
  estimateTrip,
  requestTrip,
  validateTrip,
  isValidEmail,
  validatePassword
};
