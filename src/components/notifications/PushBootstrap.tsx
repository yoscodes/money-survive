"use client";

import { useEffect } from "react";

function base64UrlToUint8Array(base64Url: string) {
  const padding = "=".repeat((4 - (base64Url.length % 4)) % 4);
  const base64 = (base64Url + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const output = new Uint8Array(raw.length);

  for (let i = 0; i < raw.length; ++i) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

async function subscribeToPush(publicKey: string) {
  const registration =
    (await navigator.serviceWorker.getRegistration()) ??
    (await navigator.serviceWorker.register("/sw.js"));
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: base64UrlToUint8Array(publicKey),
  });
}

export function PushBootstrap() {
  useEffect(() => {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!publicKey) return;
    const vapidPublicKey = publicKey;
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;
    if (!("PushManager" in window)) return;

    let cancelled = false;

    async function boot() {
      try {
        const permission =
          Notification.permission === "granted"
            ? "granted"
            : Notification.permission === "default"
              ? await Notification.requestPermission()
              : "denied";

        if (cancelled) return;

        if (permission !== "granted") {
          const registration = await navigator.serviceWorker.getRegistration();
          const existing = await registration?.pushManager.getSubscription();
          if (existing) {
            await fetch("/api/push/unsubscribe", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: existing.endpoint }),
            });
          }
          return;
        }

        const subscription = await subscribeToPush(vapidPublicKey);
        if (cancelled) return;

        const json = subscription.toJSON();
        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        });
      } catch {
        // Push 非対応ブラウザや購読失敗は黙って無効化する。
      }
    }

    void boot();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
