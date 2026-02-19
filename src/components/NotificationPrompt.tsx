'use client';

import { useState, useEffect } from 'react';
import { subscribeToPush } from '@/lib/push-client';

export default function NotificationPrompt({ notifyPush }: { notifyPush?: boolean }) {
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [dismissed, setDismissed] = useState(false);

  // SSR hydration: browser APIs only available after mount
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setPermission('unsupported');
      return;
    }
    setPermission(Notification.permission);

    if (localStorage.getItem('swapify_notif_dismissed')) {
      setDismissed(true);
    }
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

  async function requestPermission() {
    if (!('Notification' in window)) return;

    const result = await Notification.requestPermission();
    setPermission(result);

    if (result === 'granted') {
      await subscribeToPush();
      // Also enable push in profile preferences
      fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notifyPush: true }),
      }).catch(() => {});
    }
  }

  function dismiss() {
    setDismissed(true);
    localStorage.setItem('swapify_notif_dismissed', '1');
  }

  // Don't show if already granted, denied, unsupported, dismissed, or push already enabled in profile
  if (permission !== 'default' || dismissed || notifyPush) return null;

  return (
    <div className="glass rounded-2xl p-5 flex items-center justify-between gap-3">
      <div className="flex-1">
        <p className="text-base font-medium text-text-primary">Enable notifications?</p>
        <p className="text-sm text-text-secondary">
          Get notified when tracks are added or everyone has listened.
        </p>
      </div>
      <div className="flex gap-2 shrink-0">
        <button onClick={dismiss} className="btn-pill-secondary">
          Not now
        </button>
        <button onClick={requestPermission} className="btn-pill-primary">
          Enable
        </button>
      </div>
    </div>
  );
}
