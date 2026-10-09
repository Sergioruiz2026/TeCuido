const test = require('node:test');
const assert = require('node:assert/strict');
const { validateTrip, isValidEmail, validatePassword } = require('../src/server');

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
