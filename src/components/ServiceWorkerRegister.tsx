'use client';

import { useEffect } from 'react';

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          console.log('[Swapify] Service worker registered:', reg.scope);
        })
        .catch((err) => {
          console.error('[Swapify] Service worker registration failed:', err);
        });
    }
  }, []);

  return null;
}
