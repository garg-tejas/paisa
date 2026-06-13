"use client";

// frontend/lib/hooks/usePush.ts
// Web Push subscription flow for the PWA: register the service worker, ask for
// permission, subscribe with the VAPID public key, and POST it to the backend.

import { useCallback, useEffect, useState } from "react";
import { subscribePush, testPush } from "@/lib/api";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_KEY ?? "";

/** Convert a base64url VAPID key into the Uint8Array the Push API expects. */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) output[i] = raw.charCodeAt(i);
  return output;
}

export interface UsePush {
  /** True if this browser supports service workers + the Push API. */
  supported: boolean;
  /** Current Notification permission ("default" | "granted" | "denied"). */
  permission: NotificationPermission | "unsupported";
  /** True once we've confirmed an active push subscription exists. */
  subscribed: boolean;
  busy: boolean;
  error: string | null;
  /** Prompt for permission and create + persist a subscription. */
  subscribe: (notifyHour?: number) => Promise<boolean>;
  /** Fire a server-side test push to all subscriptions. */
  sendTest: () => Promise<number>;
}

export function usePush(): UsePush {
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState<
    NotificationPermission | "unsupported"
  >("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window;
    setSupported(ok);
    if (!ok) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    // Reflect any existing subscription.
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => {
        /* no SW registered yet — that's fine */
      });
  }, []);

  const subscribe = useCallback(
    async (notifyHour = 22): Promise<boolean> => {
      setError(null);
      if (!supported) {
        setError("Push notifications aren't supported on this device.");
        return false;
      }
      if (!VAPID_PUBLIC_KEY) {
        setError("Push is not configured (missing NEXT_PUBLIC_VAPID_KEY).");
        return false;
      }

      setBusy(true);
      try {
        const reg =
          (await navigator.serviceWorker.getRegistration()) ??
          (await navigator.serviceWorker.register("/sw.js"));
        await navigator.serviceWorker.ready;

        const perm = await Notification.requestPermission();
        setPermission(perm);
        if (perm !== "granted") {
          setError("Notification permission was not granted.");
          return false;
        }

        const existing = await reg.pushManager.getSubscription();
        const sub =
          existing ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
          }));

        await subscribePush(sub, notifyHour);
        setSubscribed(true);
        return true;
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to enable push.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [supported],
  );

  const sendTest = useCallback(async (): Promise<number> => {
    try {
      const { sent } = await testPush();
      return sent;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test push failed.");
      return 0;
    }
  }, []);

  return { supported, permission, subscribed, busy, error, subscribe, sendTest };
}

export default usePush;
