const test = require('node:test');
const assert = require('node:assert/strict');
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

function upstreamResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return body === undefined ? '' : JSON.stringify(body);
    }
  };
}

async function withSupabase(fetchStub, callback) {
  const previous = {
    url: process.env.SUPABASE_URL,
    key: process.env.SUPABASE_ANON_KEY,
    fetch: global.fetch
  };
  process.env.SUPABASE_URL = 'https://project.example';
  process.env.SUPABASE_ANON_KEY = 'public-anon-key';
  global.fetch = fetchStub;
  try {
    await callback();
  } finally {
    if (previous.url === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previous.url;
    if (previous.key === undefined) delete process.env.SUPABASE_ANON_KEY;
    else process.env.SUPABASE_ANON_KEY = previous.key;
    global.fetch = previous.fetch;
  }
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
  await handler(createRequest('POST', '/api/medical/access'), response);
  assert.equal(response.statusCode, 503);
  assert.match(JSON.parse(response.body).error, /autorización segura/);
});

test('allows cross-origin CRUD requests', async () => {
  const response = createResponse();
  await handler({ method: 'OPTIONS', url: '/api/profile/medical', headers: {}, socket: {} }, response);
  assert.equal(response.statusCode, 204);
  for (const method of ['PUT', 'PATCH', 'DELETE']) {
    assert.match(response.headers['Access-Control-Allow-Methods'], new RegExp(`\\b${method}\\b`));
  }
});

test('requires Supabase configuration instead of silently storing data in memory', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  try {
    const response = createResponse();
    await handler(createRequest('POST', '/api/medications', { name: 'Medicamento' }, {
      authorization: 'Bearer user-session'
    }), response);
    assert.equal(response.statusCode, 503);
    assert.match(JSON.parse(response.body).error, /base de datos/);
  } finally {
    if (previousUrl !== undefined) process.env.SUPABASE_URL = previousUrl;
    if (previousKey !== undefined) process.env.SUPABASE_ANON_KEY = previousKey;
  }
});

test('registers accounts through Supabase Auth and reports email confirmation', async () => {
  await withSupabase(async (url, options) => {
    assert.equal(url, 'https://project.example/auth/v1/signup');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      email: 'persona@example.com',
      password: 'ClaveSegura123'
    });
    return upstreamResponse(200, { user: { id: 'user-id', email: 'persona@example.com' } });
  }, async () => {
    const response = createResponse();
    await handler(createRequest('POST', '/api/auth/register', {
      email: 'Persona@Example.com',
      password: 'ClaveSegura123'
    }), response);
    assert.equal(response.statusCode, 201);
    assert.equal(JSON.parse(response.body).emailConfirmationRequired, true);
  });
});

test('passes the authenticated user token to RLS-protected medication queries', async () => {
  await withSupabase(async (url, options) => {
    assert.match(url, /\/rest\/v1\/medications\?select=\*&order=created_at.asc$/);
    assert.equal(options.headers.Authorization, 'Bearer user-session');
    assert.equal(options.headers.apikey, 'public-anon-key');
    return upstreamResponse(200, [{ id: 'med-id', name: 'Test' }]);
  }, async () => {
    const response = createResponse();
    await handler(createRequest('GET', '/api/medications', undefined, {
      authorization: 'Bearer user-session'
    }), response);
    assert.equal(response.statusCode, 200);
    assert.deepEqual(JSON.parse(response.body).medications, [{ id: 'med-id', name: 'Test' }]);
  });
});

test('validates and persists medication data', async () => {
  await withSupabase(async (url, options) => {
    assert.equal(url, 'https://project.example/rest/v1/medications');
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), {
      name: 'Vitamina',
      strength: '20 mg',
      dosage: '1 comprimido',
      instructions: '',
      notes: '',
      times: ['08:00'],
      active: true
    });
    return upstreamResponse(201, [{ id: 'med-id', name: 'Vitamina', times: ['08:00'] }]);
  }, async () => {
    const response = createResponse();
    await handler(createRequest('POST', '/api/medications', {
      name: ' Vitamina ',
      strength: '20 mg',
      dosage: '1 comprimido',
      times: ['08:00']
    }, { authorization: 'Bearer user-session' }), response);
    assert.equal(response.statusCode, 201);
    assert.equal(JSON.parse(response.body).medication.id, 'med-id');
  });
});

test('rejects invalid medication schedules before calling Supabase', async () => {
  await withSupabase(async () => {
    assert.fail('Supabase should not be called for invalid data');
  }, async () => {
    const response = createResponse();
    await handler(createRequest('POST', '/api/medications', {
      name: 'Medicamento',
      times: ['25:61']
    }, { authorization: 'Bearer user-session' }), response);
    assert.equal(response.statusCode, 422);
    assert.match(JSON.parse(response.body).error, /horarios válidos/);
  });
});

test('saves a medical profile using the authenticated Supabase user', async () => {
  await withSupabase(async (url, options) => {
    assert.equal(url, 'https://project.example/rest/v1/medical_profiles?on_conflict=user_id');
    assert.equal(options.headers.Authorization, 'Bearer user-session');
    assert.equal(options.method, 'POST');
    const profile = JSON.parse(options.body);
    assert.equal(profile.full_name, 'Ana Pérez');
    assert.equal(profile.diabetes, true);
    assert.equal(Object.hasOwn(profile, 'user_id'), false);
    return upstreamResponse(200, [{
      full_name: profile.full_name,
      rut: profile.rut,
      diabetes: profile.diabetes,
      hypertension: profile.hypertension,
      allergies: profile.allergies,
      medications: profile.medications,
      blood_type: profile.blood_type,
      emergency_contact: profile.emergency_contact
    }]);
  }, async () => {
    const response = createResponse();
    await handler(createRequest('PUT', '/api/profile/medical', {
      fullName: ' Ana Pérez ',
      diabetes: true
    }, { authorization: 'Bearer user-session' }), response);
    assert.equal(response.statusCode, 200);
    assert.equal(JSON.parse(response.body).medicalProfile.fullName, 'Ana Pérez');
  });
});

test('persists appointment details and reminder preference', async () => {
  await withSupabase(async (url, options) => {
    assert.equal(url, 'https://project.example/rest/v1/appointments');
    assert.equal(options.method, 'POST');
    const appointment = JSON.parse(options.body);
    assert.equal(appointment.title, 'Control médico');
    assert.equal(appointment.provider, 'Centro de salud');
    assert.equal(appointment.reminder_minutes, 15);
    assert.equal(appointment.completed, false);
    return upstreamResponse(201, [{ id: 'appointment-id', ...appointment }]);
  }, async () => {
    const response = createResponse();
    await handler(createRequest('POST', '/api/appointments', {
      title: ' Control médico ',
      provider: 'Centro de salud',
      startsAt: '2026-11-12T12:30:00.000Z',
      reminderMinutes: 15
    }, { authorization: 'Bearer user-session' }), response);
    assert.equal(response.statusCode, 201);
    assert.equal(JSON.parse(response.body).appointment.id, 'appointment-id');
  });
});

test('records a dose idempotently for its scheduled time', async () => {
  await withSupabase(async (url, options) => {
    assert.equal(
      url,
      'https://project.example/rest/v1/medication_doses?on_conflict=user_id,medication_id,scheduled_for'
    );
    assert.match(options.headers.Prefer, /resolution=merge-duplicates/);
    assert.deepEqual(JSON.parse(options.body), {
      medication_id: '11111111-1111-4111-8111-111111111111',
      scheduled_for: '2026-11-12T08:00:00.000Z',
      status: 'taken',
      taken_at: JSON.parse(options.body).taken_at
    });
    return upstreamResponse(201, [{ id: 'dose-id', status: 'taken' }]);
  }, async () => {
    const response = createResponse();
    await handler(createRequest(
      'POST',
      '/api/medications/11111111-1111-4111-8111-111111111111/doses',
      { status: 'taken', scheduledFor: '2026-11-12T08:00:00.000Z' },
      { authorization: 'Bearer user-session' }
    ), response);
    assert.equal(response.statusCode, 201);
    assert.equal(JSON.parse(response.body).dose.id, 'dose-id');
  });
});

test('rejects unauthenticated access to personal data', async () => {
  const response = createResponse();
  await handler(createRequest('GET', '/api/appointments'), response);
  assert.equal(response.statusCode, 401);
});
