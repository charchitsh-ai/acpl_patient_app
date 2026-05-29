import { initializeApp, getApps, getApp } from "firebase/app";
import { getMessaging, Messaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

let messaging: Messaging | null = null;

if (typeof window !== "undefined") {
  try {
    messaging = getMessaging(app);
  } catch (error) {
    console.error("Firebase Messaging failed to initialize:", error);
  }
}

export { app, messaging };

// Helper to request notification permission and get FCM Token
export async function requestAndSaveFCMToken(supabaseClient: any, userId: string) {
  if (typeof window === "undefined" || !messaging) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      console.warn("Notification permission was not granted.");
      return null;
    }

    // Get the FCM registration token
    // Note: VAPID Key is required by Firebase Web Push
    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
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
export function onMessageListener() {
  return new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      resolve(payload);
    });
  });
}
