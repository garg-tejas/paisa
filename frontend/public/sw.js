// paisa service worker — Web Push + basic lifecycle.
// Hand-written (no next-pwa). Registered by components/ServiceWorkerRegister.

self.addEventListener("install", () => {
  // Activate immediately on first install / update.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// Incoming push: the backend sends a JSON payload
// { title, body, icon, data: { url } }.
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "paisa", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "paisa";
  const options = {
    body: payload.body || "Log today's expenses.",
    icon: payload.icon || "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    data: { url: (payload.data && payload.data.url) || "/" },
    vibrate: [80, 40, 80],
    tag: payload.tag || "paisa-nudge",
    renotify: true,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Tap a notification: focus an open tab or open the target URL.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.navigate(target);
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(target);
        }
        return undefined;
      }),
  );
});
