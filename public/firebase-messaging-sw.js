importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

let messaging = null;

async function initializeMessaging() {
  if (messaging) return messaging;

  const response = await fetch("/api/firebase/config");
  if (!response.ok) {
    console.warn("[firebase-messaging-sw.js] Firebase config is unavailable.");
    return null;
  }

  const config = await response.json();
  if (
    !config.apiKey ||
    !config.authDomain ||
    !config.projectId ||
    !config.messagingSenderId ||
    !config.appId
  ) {
    console.warn("[firebase-messaging-sw.js] Firebase config is incomplete.");
    return null;
  }

  firebase.initializeApp(config);
  messaging = firebase.messaging();

  messaging.onBackgroundMessage((payload) => {
    const notificationTitle =
      payload.notification?.title || "New WhatsApp Message";
    const notificationOptions = {
      body: payload.notification?.body || "You have a new message.",
      icon: "/icon.png",
      badge: "/icon.png",
      data: payload.data || {},
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
  });

  return messaging;
}

self.addEventListener("install", (event) => {
  event.waitUntil(initializeMessaging());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(initializeMessaging());
});
