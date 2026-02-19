"use client";

import { useState, useEffect } from "react";

export default function NotificationPrompt() {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);

    // Check if already dismissed
    if (localStorage.getItem("deepdigs_notif_dismissed")) {
      setDismissed(true);
    }
  }, []);

  async function requestPermission() {
    if (!("Notification" in window)) return;

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === "granted") {
      await subscribeToPush();
    }
  }

  async function subscribeToPush() {
    try {
      const registration = await navigator.serviceWorker.ready;
      const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!vapidKey) return;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      // Send subscription to server
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription.toJSON()),
      });
    } catch (err) {
      console.error("[Deep Digs] Push subscription failed:", err);
    }
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem("deepdigs_notif_dismissed", "1");
  }

  // Don't show if already granted, denied, unsupported, or dismissed
  if (permission !== "default" || dismissed) return null;

  return (
    <div className="glass rounded-2xl p-5 flex items-center justify-between gap-3">
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">Enable notifications?</p>
        <p className="text-xs text-text-secondary">
          Get notified when tracks are added or everyone has listened.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button
          onClick={dismiss}
          className="btn-pill-secondary"
        >
          Not now
        </button>
        <button
          onClick={requestPermission}
          className="btn-pill-primary"
        >
          Enable
        </button>
      </div>
    </div>
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}
