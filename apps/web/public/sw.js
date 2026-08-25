// Minimal Web Push service worker. Registered by components/toast-provider.tsx
// and components/push-notifications.tsx. No offline caching / fetch handling
// — this app doesn't need it, and adding one would be a separate, unrelated
// concern from push delivery.

// Without these two, an updated sw.js installs but stays "waiting" until
// every tab using the old one closes — any edit here (like adding the
// postMessage broadcast below) would silently never take effect for anyone
// already registered. skipWaiting + clients.claim make a new version take
// over immediately instead.
self.addEventListener("install", () => {
  self.skipWaiting();
});
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "CareConnect", body: "You have a new notification." };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    // Non-JSON payload — fall back to the default text above.
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(data.title, {
        body: data.body,
        tag: "careconnect-notification",
      }),
      // Also hand the payload to any open tab so it can render an in-page
      // toast — the OS notification above depends on browser/OS settings
      // (site permission, Focus Assist, the browser running at all) that
      // this page has no visibility into or control over; a toast in an
      // already-open tab doesn't share those failure modes.
      self.clients
        .matchAll({ type: "window", includeUncontrolled: true })
        .then((clients) => {
          for (const client of clients) {
            client.postMessage({ type: "careconnect-push", ...data });
          }
        }),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: "window" }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow("/");
      }
    }),
  );
});
