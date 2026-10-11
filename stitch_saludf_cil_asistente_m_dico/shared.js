(function () {
  const API_URL = window.TECUIDO_API_URL || 'http://localhost:3000';
  const STORAGE_KEY = 'tecuidoSession';

  function readSession() {
    let saved;
    try {
      saved = localStorage.getItem(STORAGE_KEY);
    } catch {
      throw new Error('No se pudo acceder al almacenamiento seguro de la sesión.');
    }
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        clearSession();
        throw new Error('La sesión guardada está dañada. Ingresa nuevamente.');
      }
    }
    try {
      const oldToken = sessionStorage.getItem('tecuidoToken');
      if (oldToken) {
        const migrated = { token: oldToken, refreshToken: null, expiresAt: 0 };
        writeSession(migrated);
        sessionStorage.removeItem('tecuidoToken');
        return migrated;
      }
    } catch {
      throw new Error('No se pudo acceder al almacenamiento de la sesión.');
    }
    return null;
  }

  function writeSession(session) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      throw new Error('No se pudo guardar la sesión en este dispositivo.');
    }
  }

  function clearSession() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem('tecuidoToken');
    } catch {
      throw new Error('No se pudo cerrar la sesión local en este dispositivo.');
    }
  }

  async function readResponse(response) {
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('El servidor devolvió una respuesta no válida.');
    }
    if (!response.ok) throw new Error(data.error || 'No se pudo completar la operación.');
    return data;
  }

  async function refreshSession(session) {
    if (!session || !session.refreshToken) {
      clearSession();
      throw new Error('Tu sesión venció. Ingresa nuevamente.');
    }
    const response = await fetch(API_URL + '/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken })
    });
    let result;
    try {
      result = await response.json();
    } catch {
      clearSession();
      throw new Error('Tu sesión venció. Ingresa nuevamente.');
    }
    if (!response.ok) {
      clearSession();
      throw new Error(result.error || 'Tu sesión venció. Ingresa nuevamente.');
    }
    const renewed = {
      token: result.token,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      user: result.user
    };
    writeSession(renewed);
    return renewed;
  }

  async function request(path, options) {
    const settings = options || {};
    const headers = Object.assign({}, settings.headers || {});
    if (settings.body !== undefined) headers['Content-Type'] = 'application/json';
    let session = readSession();
    if (settings.auth !== false) {
      if (!session || !session.token) throw new Error('Inicia sesión para continuar.');
      if (session.expiresAt && session.expiresAt <= Date.now() && session.refreshToken) {
        session = await refreshSession(session);
      }
      headers.Authorization = 'Bearer ' + session.token;
    }
    const response = await fetch(API_URL + path, {
      method: settings.method || 'GET',
      headers,
      body: settings.body === undefined ? undefined : JSON.stringify(settings.body)
    });
    if (response.status === 401 && settings.auth !== false) {
      session = await refreshSession(session);
      headers.Authorization = 'Bearer ' + session.token;
      return readResponse(await fetch(API_URL + path, {
        method: settings.method || 'GET',
        headers,
        body: settings.body === undefined ? undefined : JSON.stringify(settings.body)
      }));
    }
    return readResponse(response);
  }

  async function login(email, password) {
    const result = await request('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { email: email, password: password }
    });
    writeSession({
      token: result.token,
      refreshToken: result.refreshToken,
      expiresAt: result.expiresAt,
      user: result.user
    });
    return result;
  }

  async function register(email, password) {
    return request('/api/auth/register', {
      method: 'POST',
      auth: false,
      body: { email: email, password: password }
    });
  }

  async function logout() {
    try {
      await request('/api/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }

  window.Tecuido = {
    request,
    login,
    register,
    logout,
    hasSession: function () {
      const session = readSession();
      return Boolean(session && session.token);
    },
    currentUser: function () {
      const session = readSession();
      return session && session.user ? session.user : null;
    }
  };
})();
