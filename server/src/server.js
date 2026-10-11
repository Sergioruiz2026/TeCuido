const http = require('node:http');
const PORT = Number(process.env.PORT || 3000);
const UBER_API_BASE_URL = process.env.UBER_API_BASE_URL || 'https://api.uber.com';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    const error = new Error('La base de datos aún no está configurada en el servidor.');
    error.statusCode = 503;
    throw error;
  }
  return { url: url.replace(/\/+$/, ''), anonKey };
}

async function supabaseRequest(path, { token, method = 'GET', body, prefer } = {}) {
  const { url, anonKey } = supabaseConfig();
  const headers = {
    apikey: anonKey,
    Authorization: `Bearer ${token || anonKey}`,
    Accept: 'application/json'
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (prefer) headers.Prefer = prefer;

  let response;
  try {
    response = await fetch(`${url}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch (cause) {
    const error = new Error('No se pudo conectar con el servicio de datos.');
    error.statusCode = 502;
    error.cause = cause;
    throw error;
  }

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      const error = new Error('El servicio de datos devolvió una respuesta no válida.');
      error.statusCode = 502;
      throw error;
    }
  }
  if (!response.ok) {
    const error = new Error(
      data?.msg || data?.message || data?.error_description || data?.error ||
      'No se pudo completar la operación.'
    );
    error.statusCode = response.status;
    throw error;
  }
  return data;
}

function validateMedication(payload, partial = false) {
  const result = {};
  if (!partial || Object.hasOwn(payload, 'name')) {
    if (typeof payload.name !== 'string' || !payload.name.trim() || payload.name.trim().length > 120) {
      return { error: 'Ingresa el nombre del medicamento (máximo 120 caracteres).' };
    }
    result.name = payload.name.trim();
  }
  for (const [key, maxLength] of [['strength', 80], ['dosage', 120], ['instructions', 500], ['notes', 500]]) {
    if (Object.hasOwn(payload, key)) {
      if (typeof payload[key] !== 'string' || payload[key].length > maxLength) {
        return { error: `${key} no es válido.` };
      }
      result[key] = payload[key].trim();
    } else if (!partial) {
      result[key] = '';
    }
  }
  if (Object.hasOwn(payload, 'times')) {
    if (!Array.isArray(payload.times) || payload.times.length > 8 ||
        payload.times.some(time => typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time))) {
      return { error: 'Agrega hasta 8 horarios válidos en formato HH:MM.' };
    }
    result.times = [...new Set(payload.times)].sort();
  } else if (!partial) {
    result.times = [];
  }
  if (Object.hasOwn(payload, 'active')) {
    if (typeof payload.active !== 'boolean') return { error: 'active debe ser verdadero o falso.' };
    result.active = payload.active;
  } else if (!partial) {
    result.active = true;
  }
  return { value: result };
}

function validateAppointment(payload, partial = false) {
  const result = {};
  if (!partial || Object.hasOwn(payload, 'title')) {
    if (typeof payload.title !== 'string' || !payload.title.trim() || payload.title.trim().length > 160) {
      return { error: 'Ingresa el motivo de la cita (máximo 160 caracteres).' };
    }
    result.title = payload.title.trim();
  }
  for (const [key, maxLength] of [['provider', 160], ['location', 300], ['instructions', 1000], ['phone', 40]]) {
    if (Object.hasOwn(payload, key)) {
      if (typeof payload[key] !== 'string' || payload[key].length > maxLength) {
        return { error: `${key} no es válido.` };
      }
      result[key] = payload[key].trim();
    } else if (!partial) {
      result[key] = '';
    }
  }
  if (!partial || Object.hasOwn(payload, 'startsAt')) {
    if (typeof payload.startsAt !== 'string' || !Number.isFinite(Date.parse(payload.startsAt))) {
      return { error: 'Selecciona una fecha y hora válida.' };
    }
    result.starts_at = new Date(payload.startsAt).toISOString();
  }
  if (Object.hasOwn(payload, 'reminderMinutes')) {
    if (!Number.isInteger(payload.reminderMinutes) || payload.reminderMinutes < 0 ||
        payload.reminderMinutes > 10080) {
      return { error: 'El aviso previo debe estar entre 0 y 10080 minutos.' };
    }
    result.reminder_minutes = payload.reminderMinutes;
  } else if (!partial) {
    result.reminder_minutes = 60;
  }
  if (Object.hasOwn(payload, 'completed')) {
    if (typeof payload.completed !== 'boolean') return { error: 'completed debe ser verdadero o falso.' };
    result.completed = payload.completed;
  } else if (!partial) {
    result.completed = false;
  }
  return { value: result };
}

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

function sendJson(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
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
        const body = JSON.parse(raw);
        if (!body || typeof body !== 'object' || Array.isArray(body)) {
          throw new Error('Invalid JSON payload');
        }
        resolve(body);
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
  const allowedMethods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'];
  if (!allowedMethods.includes(req.method)) {
    return sendJson(res, 405, { error: 'Método no permitido.' });
  }

  try {
    if (route === '/api/auth/register' && req.method === 'POST') {
      const payload = await readJson(req);
      if (!isValidEmail(payload.email)) {
        return sendJson(res, 422, { error: 'Ingresa un correo real, por ejemplo: nombre@dominio.com.' });
      }
      const passwordError = validatePassword(payload.password);
      if (passwordError) return sendJson(res, 422, { error: passwordError });
      const result = await supabaseRequest('/auth/v1/signup', {
        method: 'POST',
        body: { email: payload.email.trim().toLowerCase(), password: payload.password }
      });
      return sendJson(res, 201, {
        ok: true,
        message: result.access_token ? 'Cuenta creada.' : 'Revisa tu correo para confirmar la cuenta.',
        emailConfirmationRequired: !result.access_token,
        user: result.user ? { id: result.user.id, email: result.user.email } : undefined
      });
    }
    if (route === '/api/auth/login' && req.method === 'POST') {
      const payload = await readJson(req);
      if (!isValidEmail(payload.email) || typeof payload.password !== 'string') {
        return sendJson(res, 422, { error: 'Correo o contraseña no válidos.' });
      }
      const result = await supabaseRequest('/auth/v1/token?grant_type=password', {
        method: 'POST',
        body: { email: payload.email.trim().toLowerCase(), password: payload.password }
      });
      return sendJson(res, 200, {
        ok: true,
        token: result.access_token,
        refreshToken: result.refresh_token,
        expiresAt: Date.now() + (result.expires_in || 3600) * 1000,
        user: { id: result.user.id, email: result.user.email }
      });
    }
    if (route === '/api/auth/refresh' && req.method === 'POST') {
      const payload = await readJson(req);
      if (typeof payload.refreshToken !== 'string' || !payload.refreshToken) {
        return sendJson(res, 401, { error: 'La sesión venció. Inicia sesión nuevamente.' });
      }
      const result = await supabaseRequest('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: payload.refreshToken }
      });
      return sendJson(res, 200, {
        ok: true,
        token: result.access_token,
        refreshToken: result.refresh_token,
        expiresAt: Date.now() + (result.expires_in || 3600) * 1000,
        user: { id: result.user.id, email: result.user.email }
      });
    }
    if (route === '/api/auth/logout' && req.method === 'POST') {
      const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
      if (token) await supabaseRequest('/auth/v1/logout', { method: 'POST', token });
      return sendJson(res, 200, { ok: true });
    }

    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (route.startsWith('/api/profile/') || route.startsWith('/api/medications') ||
        route.startsWith('/api/appointments') || route.startsWith('/api/medication-doses')) {
      if (!token) return sendJson(res, 401, { error: 'Inicia sesión para continuar.' });
    }

    if (route === '/api/profile/medical' && req.method === 'GET') {
      const rows = await supabaseRequest('/rest/v1/medical_profiles?select=*', { token });
      const row = rows[0];
      const medicalProfile = row ? {
        fullName: row.full_name,
        rut: row.rut,
        diabetes: row.diabetes,
        hypertension: row.hypertension,
        allergies: row.allergies,
        medications: row.medications,
        bloodType: row.blood_type,
        emergencyContact: row.emergency_contact
      } : {};
      return sendJson(res, 200, { medicalProfile });
    }
    if (route === '/api/profile/medical' && req.method === 'PUT') {
      const payload = await readJson(req);
      const fields = {
        full_name: ['fullName', 120],
        rut: ['rut', 20],
        allergies: ['allergies', 500],
        medications: ['medications', 500],
        blood_type: ['bloodType', 10],
        emergency_contact: ['emergencyContact', 100]
      };
      const row = {};
      for (const [column, [key, max]] of Object.entries(fields)) {
        if (payload[key] !== undefined && typeof payload[key] !== 'string') {
          return sendJson(res, 422, { error: `${key} debe ser texto.` });
        }
        row[column] = typeof payload[key] === 'string' ? payload[key].trim().slice(0, max) : '';
      }
      for (const key of ['diabetes', 'hypertension']) {
        if (payload[key] !== undefined && typeof payload[key] !== 'boolean') {
          return sendJson(res, 422, { error: `${key} debe ser verdadero o falso.` });
        }
        row[key] = payload[key] === true;
      }
      const rows = await supabaseRequest('/rest/v1/medical_profiles?on_conflict=user_id', {
        token,
        method: 'POST',
        body: row,
        prefer: 'resolution=merge-duplicates,return=representation'
      });
      return sendJson(res, 200, { ok: true, medicalProfile: {
        fullName: rows[0].full_name,
        rut: rows[0].rut,
        diabetes: rows[0].diabetes,
        hypertension: rows[0].hypertension,
        allergies: rows[0].allergies,
        medications: rows[0].medications,
        bloodType: rows[0].blood_type,
        emergencyContact: rows[0].emergency_contact
      } });
    }

    if (route === '/api/medications' && req.method === 'GET') {
      const rows = await supabaseRequest('/rest/v1/medications?select=*&order=created_at.asc', { token });
      return sendJson(res, 200, { medications: rows });
    }
    if (route === '/api/medications' && req.method === 'POST') {
      const validated = validateMedication(await readJson(req));
      if (validated.error) return sendJson(res, 422, { error: validated.error });
      const body = {
        name: validated.value.name,
        strength: validated.value.strength,
        dosage: validated.value.dosage,
        instructions: validated.value.instructions,
        notes: validated.value.notes,
        times: validated.value.times,
        active: validated.value.active
      };
      const rows = await supabaseRequest('/rest/v1/medications', {
        token, method: 'POST', body, prefer: 'return=representation'
      });
      return sendJson(res, 201, { medication: rows[0] });
    }
    const medicationRoute = route.match(/^\/api\/medications\/([^/]+)(?:\/doses)?$/);
    if (medicationRoute && !UUID_PATTERN.test(medicationRoute[1])) {
      return sendJson(res, 422, { error: 'Identificador de medicamento no válido.' });
    }
    if (medicationRoute && route.endsWith('/doses') && req.method === 'POST') {
      const payload = await readJson(req);
      const scheduledFor = payload.scheduledFor || new Date().toISOString();
      if (!['taken', 'skipped'].includes(payload.status) || !Number.isFinite(Date.parse(scheduledFor))) {
        return sendJson(res, 422, { error: 'El registro de toma no es válido.' });
      }
      const rows = await supabaseRequest(
        '/rest/v1/medication_doses?on_conflict=user_id,medication_id,scheduled_for', {
        token,
        method: 'POST',
        body: {
          medication_id: medicationRoute[1],
          scheduled_for: new Date(scheduledFor).toISOString(),
          status: payload.status,
          taken_at: payload.status === 'taken' ? new Date().toISOString() : null
        },
        prefer: 'resolution=merge-duplicates,return=representation'
      });
      return sendJson(res, 201, { dose: rows[0] });
    }
    if (medicationRoute && route.endsWith('/doses')) {
      return sendJson(res, 405, { error: 'Método no permitido para el registro de tomas.' });
    }
    if (medicationRoute && req.method === 'PATCH') {
      const validated = validateMedication(await readJson(req), true);
      if (validated.error) return sendJson(res, 422, { error: validated.error });
      const rows = await supabaseRequest(`/rest/v1/medications?id=eq.${medicationRoute[1]}`, {
        token, method: 'PATCH', body: validated.value, prefer: 'return=representation'
      });
      if (!rows.length) return sendJson(res, 404, { error: 'No se encontró el medicamento.' });
      return sendJson(res, 200, { medication: rows[0] });
    }
    if (medicationRoute && req.method === 'DELETE') {
      await supabaseRequest(`/rest/v1/medications?id=eq.${medicationRoute[1]}`, {
        token, method: 'DELETE'
      });
      return sendJson(res, 200, { ok: true });
    }

    if (route === '/api/medication-doses' && req.method === 'GET') {
      const query = new URL(req.url, 'http://localhost').searchParams;
      const from = query.get('from');
      const to = query.get('to');
      if (!from || !to || !Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to))) {
        return sendJson(res, 422, { error: 'Indica un intervalo de fechas válido.' });
      }
      const params = new URLSearchParams({
        select: '*',
        and: `(scheduled_for.gte.${new Date(from).toISOString()},scheduled_for.lt.${new Date(to).toISOString()})`,
        order: 'scheduled_for.asc'
      });
      const rows = await supabaseRequest(`/rest/v1/medication_doses?${params}`, { token });
      return sendJson(res, 200, { doses: rows });
    }

    if (route === '/api/appointments' && req.method === 'GET') {
      const rows = await supabaseRequest('/rest/v1/appointments?select=*&order=starts_at.asc', { token });
      return sendJson(res, 200, { appointments: rows });
    }
    if (route === '/api/appointments' && req.method === 'POST') {
      const validated = validateAppointment(await readJson(req));
      if (validated.error) return sendJson(res, 422, { error: validated.error });
      const rows = await supabaseRequest('/rest/v1/appointments', {
        token, method: 'POST', body: validated.value, prefer: 'return=representation'
      });
      return sendJson(res, 201, { appointment: rows[0] });
    }
    const appointmentRoute = route.match(/^\/api\/appointments\/([^/]+)$/);
    if (appointmentRoute && !UUID_PATTERN.test(appointmentRoute[1])) {
      return sendJson(res, 422, { error: 'Identificador de cita no válido.' });
    }
    if (appointmentRoute && req.method === 'PATCH') {
      const validated = validateAppointment(await readJson(req), true);
      if (validated.error) return sendJson(res, 422, { error: validated.error });
      const rows = await supabaseRequest(`/rest/v1/appointments?id=eq.${appointmentRoute[1]}`, {
        token, method: 'PATCH', body: validated.value, prefer: 'return=representation'
      });
      if (!rows.length) return sendJson(res, 404, { error: 'No se encontró la cita.' });
      return sendJson(res, 200, { appointment: rows[0] });
    }
    if (appointmentRoute && req.method === 'DELETE') {
      await supabaseRequest(`/rest/v1/appointments?id=eq.${appointmentRoute[1]}`, {
        token, method: 'DELETE'
      });
      return sendJson(res, 200, { ok: true });
    }

    if (route === '/api/medical/access' && req.method === 'POST') {
      return sendJson(res, 503, {
        error: 'El acceso público a fichas médicas está temporalmente deshabilitado hasta implementar autorización segura.'
      });
    }
    if (route === '/api/transport/uber/estimate' && req.method === 'POST') {
      return sendJson(res, 200, await estimateTrip(await readJson(req)));
    }
    if (route === '/api/transport/uber/request' && req.method === 'POST') {
      return sendJson(res, 200, await requestTrip(await readJson(req)));
    }
    return sendJson(res, 404, { error: 'Ruta no encontrada.' });
  } catch (error) {
    const status = Number.isInteger(error.statusCode) ? error.statusCode :
      ['Invalid JSON', 'Invalid JSON payload'].includes(error.message) ? 400 : 500;
    if (status >= 500) console.error(`[api] ${req.method} ${route} failed with status ${status}`);
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
