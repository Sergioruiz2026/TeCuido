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

  const alarmChannelId = 'tecuido-medication-reminders';
  const alarmDataType = 'tecuido-medication-reminder';

  function isNativePlatform() {
    return Boolean(
      window.Capacitor &&
      typeof window.Capacitor.isNativePlatform === 'function' &&
      window.Capacitor.isNativePlatform()
    );
  }

  function getLocalNotifications() {
    const plugins = window.Capacitor && window.Capacitor.Plugins;
    const localNotifications = plugins && plugins.LocalNotifications;
    if (!localNotifications) {
      throw new Error('No se pudo iniciar el servicio de recordatorios del teléfono.');
    }
    return localNotifications;
  }

  function alarmStatus(notificationPermission, exactAlarmPermission) {
    return {
      available: true,
      notifications: notificationPermission,
      exactAlarm: exactAlarmPermission,
      granted: notificationPermission === 'granted' && exactAlarmPermission === 'granted'
    };
  }

  async function pedirPermisos() {
    if (!isNativePlatform()) {
      return { available: false, notifications: 'unavailable', exactAlarm: 'unavailable', granted: false };
    }
    const localNotifications = getLocalNotifications();
    let notificationPermission = await localNotifications.checkPermissions();
    if (notificationPermission.display === 'prompt' || notificationPermission.display === 'prompt-with-rationale') {
      notificationPermission = await localNotifications.requestPermissions();
    }
    const exactAlarmPermission = await localNotifications.checkExactNotificationSetting();
    return alarmStatus(notificationPermission.display, exactAlarmPermission.exact_alarm);
  }

  function notificationId(medicationId, time) {
    const value = 'tecuido:' + medicationId + ':' + time;
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash = Math.imul(hash ^ value.charCodeAt(index), 16777619);
    }
    return (hash >>> 0) % 2147483647 + 1;
  }

  function reminderData(notification) {
    return notification && (notification.extra || notification.data);
  }

  function isMedicationReminder(notification) {
    const data = reminderData(notification);
    return data && data.type === alarmDataType;
  }

  async function cancelOwnedNotifications(localNotifications, matches) {
    const pending = await localNotifications.getPending();
    const notifications = (pending.notifications || [])
      .filter(notification => isMedicationReminder(notification) && matches(notification))
      .map(notification => ({ id: notification.id }));
    if (notifications.length) await localNotifications.cancel({ notifications });
    const delivered = await localNotifications.getDeliveredNotifications();
    const deliveredNotifications = (delivered.notifications || [])
      .filter(notification => isMedicationReminder(notification) && matches(notification));
    if (deliveredNotifications.length) {
      await localNotifications.removeDeliveredNotifications({ notifications: deliveredNotifications });
    }
    return notifications.length + deliveredNotifications.length;
  }

  async function reprogramarTodo(medicamentos) {
    if (!isNativePlatform()) {
      return { available: false, notifications: 'unavailable', exactAlarm: 'unavailable', granted: false };
    }
    if (!Array.isArray(medicamentos)) {
      throw new Error('No se pudo leer la lista de medicamentos para programar recordatorios.');
    }

    const localNotifications = getLocalNotifications();
    const notifications = [];
    const usedIds = new Set();
    medicamentos.filter(medication => medication && medication.active === true).forEach(medication => {
      if (medication.id === undefined || medication.id === null || !Array.isArray(medication.times)) {
        throw new Error('Hay un medicamento activo con datos incompletos; revisa su ficha antes de programar alarmas.');
      }
      medication.times.forEach(time => {
        if (typeof time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
          throw new Error('Hay un horario de medicamento no válido; corrígelo antes de programar alarmas.');
        }
        const id = notificationId(String(medication.id), time);
        if (usedIds.has(id)) {
          throw new Error('No se pudieron identificar de forma única dos recordatorios de medicamentos.');
        }
        usedIds.add(id);
        const [hour, minute] = time.split(':').map(Number);
        const dosage = medication.dosage || medication.strength;
        notifications.push({
          id,
          title: 'Hora de tu medicamento',
          body: dosage ? medication.name + ' · ' + dosage : medication.name,
          schedule: { on: { hour, minute }, repeats: true, allowWhileIdle: true },
          channelId: alarmChannelId,
          extra: {
            type: alarmDataType,
            medicationId: String(medication.id),
            time
          }
        });
      });
    });

    if (!notifications.length) {
      await cancelOwnedNotifications(localNotifications, () => true);
      return { available: true, notifications: 'granted', exactAlarm: 'granted', granted: true, scheduled: 0 };
    }

    const permission = await pedirPermisos();
    if (!permission.granted) {
      await cancelOwnedNotifications(localNotifications, () => true);
      return permission;
    }

    await localNotifications.createChannel({
      id: alarmChannelId,
      name: 'Recordatorios de medicamentos',
      description: 'Avisos diarios para tomar tus medicamentos',
      importance: 4,
      vibration: true
    });
    await cancelOwnedNotifications(localNotifications, () => true);
    if (notifications.length) await localNotifications.schedule({ notifications });
    return Object.assign({}, permission, { scheduled: notifications.length });
  }

  async function cancelarMedicamento(id) {
    if (!isNativePlatform()) return { available: false, canceled: 0 };
    if (id === undefined || id === null || String(id) === '') {
      throw new Error('No se pudo identificar el medicamento que quieres cancelar.');
    }
    const localNotifications = getLocalNotifications();
    const canceled = await cancelOwnedNotifications(
      localNotifications,
      notification => reminderData(notification).medicationId === String(id)
    );
    return { available: true, canceled };
  }

  async function abrirAjustes() {
    if (!isNativePlatform()) return { available: false };
    const localNotifications = getLocalNotifications();
    const permission = await pedirPermisos();
    if (permission.notifications !== 'granted') {
      const plugins = window.Capacitor && window.Capacitor.Plugins;
      const settings = plugins && plugins.TecuidoSettings;
      if (!settings || typeof settings.openNotificationSettings !== 'function') {
        throw new Error('No se pudieron abrir los ajustes de notificaciones de TeCuido.');
      }
      await settings.openNotificationSettings();
      return { available: true, opened: 'notifications' };
    }
    const exactPermission = await localNotifications.checkExactNotificationSetting();
    if (exactPermission.exact_alarm !== 'granted') {
      await localNotifications.changeExactNotificationSetting();
      return { available: true, opened: 'exactAlarm' };
    }
    return { available: true, opened: 'notifications' };
  }

  function listenForAlarmTaps() {
    if (!isNativePlatform()) return;
    const localNotifications = getLocalNotifications();
    localNotifications.addListener('localNotificationActionPerformed', action => {
      const notification = action && action.notification;
      const extra = notification && notification.extra;
      if (!extra || extra.type !== alarmDataType || !extra.medicationId) return;
      const scriptUrl = document.currentScript && document.currentScript.src;
      const sharedScript = scriptUrl || new URL('../shared.js', location.href).href;
      const alarmUrl = new URL(
        './alarma_activa_medicamento_pendiente/code.html?medicationId=' +
          encodeURIComponent(extra.medicationId) +
          '&time=' + encodeURIComponent(extra.time || ''),
        sharedScript
      );
      location.replace(alarmUrl.href);
    });
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
  window.TecuidoAlarms = { pedirPermisos, reprogramarTodo, cancelarMedicamento, abrirAjustes };
  listenForAlarmTaps();
})();
