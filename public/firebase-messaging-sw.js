// Import Firebase scripts from CDN (modular SDK)
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js");

// Initialize the Firebase app in the service worker by passing in the messagingSenderId
firebase.initializeApp({
  apiKey: "AIzaSyBF3UKOALwwsbzlxT5aVd7NOb7HAogEdXY",
  authDomain: "ddcworld-98395.firebaseapp.com",
  projectId: "ddcworld-98395",
  storageBucket: "ddcworld-98395.firebasestorage.app",
  messagingSenderId: "994264073718",
  appId: "1:994264073718:web:f972b76b5e8652ff1eb3d7",
  measurementId: "G-RYCG67G9NQ"
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[firebase-messaging-sw.js] Received background message: ", payload);

  // Customize notification here
  const notificationTitle = payload.notification?.title || "New WhatsApp Message";
  const notificationOptions = {
    body: payload.notification?.body || "You have a new message.",
    icon: "/icon.png",
    badge: "/icon.png",
    data: payload.data || {}
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
