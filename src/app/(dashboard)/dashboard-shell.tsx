"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellOff } from "lucide-react";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { createClient } from "@/lib/supabase/client";
import {
  onForegroundMessage,
  requestAndSaveFCMToken,
} from "@/lib/firebase/config";
import { toast } from "sonner";

// Auth-gated dashboard shell. Extracted from the layout so the layout
// itself can stay a server component and export metadata (noindex) —
// client components can't export Next's metadata object.

function DashboardShellInner({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [notificationPermission, setNotificationPermission] =
    useState<NotificationPermission | "unsupported">("default");
  const [savingPushToken, setSavingPushToken] = useState(false);

  // Sidebar drawer state — only used on mobile. On lg+ the sidebar is
  // always visible and this stays at `false` (ignored by the component).
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      return;
    }

    setNotificationPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (loading || !user || notificationPermission !== "granted") return;

    const supabase = createClient();
    void requestAndSaveFCMToken(supabase, user.id);
  }, [loading, notificationPermission, user]);

  useEffect(() => {
    if (loading || !user) return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void onForegroundMessage((payload) => {
      toast(payload.notification?.title || "New Message Received", {
        description: payload.notification?.body || "You have a new message.",
        duration: 5000,
      });
    }).then((cleanup) => {
      if (cancelled) {
        cleanup?.();
        return;
      }
      unsubscribe = cleanup;
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [loading, user]);

  async function enableNotifications() {
    if (!user) return;
    if (typeof window === "undefined" || !("Notification" in window)) {
      setNotificationPermission("unsupported");
      toast.error("This browser does not support notifications.");
      return;
    }

    setSavingPushToken(true);
    try {
      const supabase = createClient();
      const token = await requestAndSaveFCMToken(supabase, user.id);
      setNotificationPermission(Notification.permission);

      if (token) {
        toast.success("Notifications enabled for new WhatsApp messages.");
      } else if (Notification.permission === "denied") {
        toast.error("Notifications are blocked. Enable them from browser site settings.");
      } else {
        toast.error("Could not enable notifications. Check Firebase settings and try again.");
      }
    } finally {
      setSavingPushToken(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-slate-400">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // The inbox page manages its own layout (3-column panels that fill the
  // viewport). Strip default shell padding so it doesn't need the negative-
  // margin hack, and let its own flex containers handle overflow.
  const isInbox = pathname.startsWith("/inbox");

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950">
      <Sidebar open={sidebarOpen} onClose={closeSidebar} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header onOpenSidebar={() => setSidebarOpen(true)} />
        {notificationPermission === "default" && (
          <div className="flex shrink-0 flex-col gap-2 border-b border-primary/20 bg-primary/10 px-4 py-3 text-sm text-slate-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Bell className="mt-0.5 size-4 shrink-0 text-primary" />
              <p>
                Enable browser notifications to get alerts for new WhatsApp
                conversations and messages.
              </p>
            </div>
            <button
              type="button"
              onClick={enableNotifications}
              disabled={savingPushToken}
              className="inline-flex h-9 shrink-0 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingPushToken ? "Enabling..." : "Enable notifications"}
            </button>
          </div>
        )}
        {notificationPermission === "denied" && (
          <div className="flex shrink-0 items-start gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
            <BellOff className="mt-0.5 size-4 shrink-0" />
            <p>
              Notifications are blocked for this site. Open browser site
              settings, allow notifications, then reload the app.
            </p>
          </div>
        )}
        {/* Inbox controls its own layout (zero padding, overflow hidden).
            All other pages keep the default responsive padding. */}
        <main className={isInbox ? "inbox-no-pad flex-1" : "flex-1 overflow-y-auto p-4 sm:p-6"}>
          {children}
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShellInner>{children}</DashboardShellInner>
    </AuthProvider>
  );
}
