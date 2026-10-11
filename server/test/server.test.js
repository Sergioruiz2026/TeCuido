const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { handler, validateTrip, isValidEmail, validatePassword } = require('../src/server');

function createResponse() {
  return {
    statusCode: null,
    headers: null,
    body: null,
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    }
  };
}

function createRequest(method, url, body, headers = {}) {
  const request = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  request.method = method;
  request.url = url;
  request.headers = headers;
  request.socket = {};
  return request;
}

test('rejects trips without coordinates', () => {
  assert.equal(
    validateTrip({ origin: { address: 'Mi casa' }, destination: {} }),
    'origin requiere latitude y longitude numéricas.'
  );
});

test('accepts valid trip coordinates', () => {
  assert.equal(
    validateTrip({
      origin: { latitude: -33.45, longitude: -70.66 },
      destination: { latitude: -33.42, longitude: -70.61 },
      rideType: 'assist'
    }),
    null
  );
});

test('rejects unsupported ride types', () => {
  assert.equal(
    validateTrip({
      origin: { latitude: 1, longitude: 1 },
      destination: { latitude: 2, longitude: 2 },
      rideType: 'helicopter'
    }),
    'rideType no válido.'
  );
});

test('accepts a real email format and rejects arbitrary text', () => {
  assert.equal(isValidEmail('persona@example.com'), true);
  assert.equal(isValidEmail('persona@'), false);
  assert.equal(isValidEmail('solo texto'), false);
});

test('enforces a strong password policy', () => {
  assert.equal(validatePassword('ClaveSegura123'), null);
  assert.match(validatePassword('12345678'), /mayúscula/);
  assert.match(validatePassword('ClaveSegura'), /número/);
});

test('disables public emergency medical profile access', async () => {
  const response = createResponse();

  await handler(
    { method: 'POST', url: '/api/medical/access', headers: {}, socket: {} },
    response
  );

  assert.equal(response.statusCode, 503);
  assert.match(JSON.parse(response.body).error, /autorización segura/);
});

test('allows cross-origin PUT requests for medical profiles', async () => {
  const response = createResponse();

  await handler(
    { method: 'OPTIONS', url: '/api/profile/medical', headers: {}, socket: {} },
    response
  );

  assert.equal(response.statusCode, 204);
  assert.match(response.headers['Access-Control-Allow-Methods'], /\bPUT\b/);
});

test('saves a medical profile using the authenticated session', async () => {
  const email = `profile-${crypto.randomUUID()}@example.com`;
  const password = 'TeCuido2026';
  const registerResponse = createResponse();
  await handler(createRequest('POST', '/api/auth/register', { email, password }), registerResponse);
  assert.equal(registerResponse.statusCode, 201);

  const loginResponse = createResponse();
  await handler(createRequest('POST', '/api/auth/login', { email, password }), loginResponse);
  assert.equal(loginResponse.statusCode, 200);

  const token = JSON.parse(loginResponse.body).token;
  const saveResponse = createResponse();
  await handler(
    createRequest('PUT', '/api/profile/medical', {
      fullName: 'Ana Pérez González',
      rut: '12.345.678-9',
      diabetes: true,
      hypertension: false,
      allergies: 'Penicilina',
      medications: 'Losartán 50 mg',
      bloodType: 'O+',
      emergencyContact: 'María 912345678'
    }, { authorization: `Bearer ${token}` }),
    saveResponse
  );

  assert.equal(saveResponse.statusCode, 200);
  assert.deepEqual(JSON.parse(saveResponse.body).medicalProfile, {
    fullName: 'Ana Pérez González',
    rut: '12.345.678-9',
    diabetes: true,
    hypertension: false,
    allergies: 'Penicilina',
    medications: 'Losartán 50 mg',
    bloodType: 'O+',
    emergencyContact: 'María 912345678'
  });
});
