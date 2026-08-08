/* PixelFlip service worker — receives web push and opens the listing on click.
 *
 * This file must live at the site root (/sw.js). A service worker can only
 * control pages at or below its own path, so serving it from a subdirectory
 * would silently limit its scope.
 */

self.addEventListener('install', (event) => {
  // Take over immediately instead of waiting for existing tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'PixelFlip', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'PixelFlip';
  const options = {
    body: payload.body || 'New listing match',
    icon: payload.icon || '/apple_touch_icon.png',
    badge: payload.badge || '/favicon-32x32.png',
    // Lets a click open the exact listing rather than just the dashboard.
    data: { url: payload.url || '/' },
    // Collapses repeat alerts into one entry instead of stacking them up.
    tag: payload.tag || 'pixelflip-listing',
    renotify: true,
    requireInteraction: false,
  };

  // Tell any open tab a push landed, so the dashboard can refresh its list
  // without waiting for the next poll (and so tests can observe delivery).
  const notify = self.clients
    .matchAll({ type: 'window', includeUncontrolled: true })
    .then((cs) => cs.forEach((c) => c.postMessage({ type: 'PIXELFLIP_PUSH', payload })));

  event.waitUntil(Promise.all([self.registration.showNotification(title, options), notify]));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  // Focus an already-open PixelFlip tab when there is one; only open a new
  // tab as a fallback, so clicking alerts doesn't pile up duplicate windows.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client && target !== '/') {
            return client.navigate(target).then((c) => c && c.focus());
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    })
  );
});
