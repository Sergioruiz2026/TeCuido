const test = require('node:test');
const assert = require('node:assert/strict');
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
