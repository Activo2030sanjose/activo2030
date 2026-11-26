/* Notificaciones del portal de socios */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));
self.addEventListener('push', e => {
  let d = {}; try { d = e.data.json(); } catch (_) { d = { titulo: 'Club Activo 20-30 San José', mensaje: e.data ? e.data.text() : '' }; }
  e.waitUntil(self.registration.showNotification(d.titulo || 'Club Activo 20-30 San José', { body: d.mensaje || '', icon: '../img/logo-color.png', badge: '../img/logo-color.png', data: { url: d.url || './' } }));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then(ws => { for (const w of ws) if (w.url.includes('/socios/') && 'focus' in w) return w.focus(); return self.clients.openWindow(e.notification.data.url); }));
});
