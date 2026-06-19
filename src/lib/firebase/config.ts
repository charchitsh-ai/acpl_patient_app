import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import {
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type MessagePayload,
  type Messaging,
} from "firebase/messaging";

interface FcmTokenClient {
  from: (table: "user_fcm_tokens") => {
    upsert: (
      values: { user_id: string; token: string; updated_at: string },
      options: { onConflict: string },
    ) => PromiseLike<{ error: { message: string } | null }>;
  };
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const hasFirebaseBrowserConfig = Boolean(
  firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId &&
    firebaseConfig.messagingSenderId &&
    firebaseConfig.appId,
);

// Initialize Firebase only when this deployment has browser config.
const app: FirebaseApp | null = hasFirebaseBrowserConfig
  ? getApps().length === 0
    ? initializeApp(firebaseConfig)
    : getApp()
  : null;

let messaging: Messaging | null = null;
let messagingInitPromise: Promise<Messaging | null> | null = null;

async function getBrowserMessaging() {
  if (messaging) return messaging;
  if (messagingInitPromise) return messagingInitPromise;

  messagingInitPromise = (async () => {
    if (typeof window === "undefined" || !app || !hasFirebaseBrowserConfig) {
      return null;
    }

    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      console.warn("Firebase Messaging is not supported in this browser.");
      return null;
    }

    const supported = await isSupported().catch(() => false);
    if (!supported) {
      console.warn("Firebase Messaging is not supported in this browser.");
      return null;
    }

    try {
      messaging = getMessaging(app);
      return messaging;
    } catch (error) {
      console.error("Firebase Messaging failed to initialize:", error);
      return null;
    }
  })();

  return messagingInitPromise;
}

export { app, getBrowserMessaging, hasFirebaseBrowserConfig };

// Helper to request notification permission and get FCM Token
export async function requestAndSaveFCMToken(
  supabaseClient: FcmTokenClient,
  userId: string,
) {
  if (typeof window === "undefined") return null;

  if (!hasFirebaseBrowserConfig) {
    console.warn(
      "Firebase push notifications are not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.",
    );
    return null;
  }

  const activeMessaging = await getBrowserMessaging();
  if (!activeMessaging) return null;

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;
  if (!vapidKey) {
    console.warn("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not set. Cannot register push token.");
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission was not granted.");
      return null;
    }

    // Get the FCM registration token
    // Note: VAPID Key is required by Firebase Web Push
    const serviceWorkerRegistration = await navigator.serviceWorker.register(
      "/firebase-messaging-sw.js",
    );

    const token = await getToken(activeMessaging, {
      vapidKey,
      serviceWorkerRegistration,
    });

    if (token) {
      console.log("FCM Token retrieved successfully:", token);
      
      // Save/Upsert the token to user_fcm_tokens table in Supabase
      const { error } = await supabaseClient
        .from("user_fcm_tokens")
        .upsert(
          { user_id: userId, token, updated_at: new Date().toISOString() },
          { onConflict: "user_id,token" }
        );

      if (error) {
        console.error("Error saving FCM Token to Supabase:", error.message);
      } else {
        console.log("FCM Token saved to database successfully.");
      }
      
      return token;
    } else {
      console.warn("No registration token available. Request permission to generate one.");
      return null;
    }
  } catch (error) {
    console.error("An error occurred while retrieving FCM token:", error);
    return null;
  }
}

// Helper to listen to active foreground messages
export async function onForegroundMessage(
  callback: (payload: MessagePayload) => void,
) {
  const activeMessaging = await getBrowserMessaging();
  if (!activeMessaging) return undefined;

  return onMessage(activeMessaging, callback);
}
