import { GoogleAuth } from "google-auth-library";
import { createClient } from "@supabase/supabase-js";

// Lazy-initialized admin client to lookup tokens
let _adminClient: any = null
function supabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
  }
  return _adminClient
}

/**
 * Send an FCM Push Notification to all registered tokens of a user.
 */
export async function sendFCMNotification(
  userId: string,
  payload: {
    title: string;
    body: string;
    data?: Record<string, string>;
  }
) {
  try {
    const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountEnv) {
      console.warn(
        "[FCM Server] FIREBASE_SERVICE_ACCOUNT env var is not set. Skipping FCM push notification."
      );
      return;
    }

    let serviceAccount;
    try {
      serviceAccount = JSON.parse(serviceAccountEnv);
    } catch (e) {
      console.error("[FCM Server] Failed to parse FIREBASE_SERVICE_ACCOUNT JSON env var.");
      return;
    }

    const projectId = serviceAccount.project_id;
    if (!projectId) {
      console.error("[FCM Server] FIREBASE_SERVICE_ACCOUNT is missing 'project_id'.");
      return;
    }

    // 1. Fetch active FCM tokens for this user from Supabase
    const { data: tokens, error } = await supabaseAdmin()
      .from("user_fcm_tokens")
      .select("token")
      .eq("user_id", userId);

    if (error) {
      console.error("[FCM Server] Error fetching FCM tokens from Supabase:", error.message);
      return;
    }

    if (!tokens || tokens.length === 0) {
      console.log(`[FCM Server] No registered FCM tokens found for user ${userId}.`);
      return;
    }

    console.log(
      `[FCM Server] Found ${tokens.length} registered FCM tokens for user ${userId}. Sending push...`
    );

    // 2. Obtain Google OAuth2 access token for FCM
    const auth = new GoogleAuth({
      credentials: {
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ["https://www.googleapis.com/auth/firebase.messaging"],
    });

    const accessToken = await auth.getAccessToken();
    if (!accessToken) {
      throw new Error("Failed to get Google OAuth2 access token");
    }

    // 3. Send notification to each registered token
    const results = await Promise.all(
      tokens.map(async ({ token }: { token: string }) => {
        try {
          const response = await fetch(
            `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: {
                  token,
                  notification: {
                    title: payload.title,
                    body: payload.body,
                  },
                  data: payload.data || {},
                  webpush: {
                    fcm_options: {
                      link: "/inbox", // Standard click redirect
                    },
                  },
                },
              }),
            }
          );

          if (!response.ok) {
            const errText = await response.text();
            
            // If token is invalid or expired, automatically clean it up from the DB!
            if (response.status === 400 || response.status === 404) {
              console.log(`[FCM Server] Removing invalid/expired FCM token: ${token.substring(0, 15)}...`);
              await supabaseAdmin()
                .from("user_fcm_tokens")
                .delete()
                .eq("token", token);
            }
            
            throw new Error(`FCM API returned status ${response.status}: ${errText}`);
          }

          const resData = await response.json();
          return { token, success: true, messageId: resData.name };
        } catch (err: any) {
          console.error(`[FCM Server] Failed to send push to token:`, err.message || err);
          return { token, success: false, error: err.message || err };
        }
      })
    );

    console.log("[FCM Server] Finished dispatching notifications:", results);
  } catch (error: any) {
    console.error("[FCM Server] Fatal error in sendFCMNotification:", error.message || error);
  }
}
