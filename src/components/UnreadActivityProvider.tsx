'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';

interface UnreadActivityContextValue {
  unreadCount: number;
  refreshUnread: () => void;
  markRead: (opts?: { playlistId?: string; circleId?: string }) => void;
}

const UnreadActivityContext = createContext<UnreadActivityContextValue>({
  unreadCount: 0,
  refreshUnread: () => {},
  markRead: () => {},
});

export function useUnreadActivity() {
  return useContext(UnreadActivityContext);
}

export default function UnreadActivityProvider({ children }: { children: React.ReactNode }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const fetchingRef = useRef(false);

  const fetchUnread = useCallback(() => {
    if (fetchingRef.current) return;
    fetchingRef.current = true;
    fetch('/api/activity/unread')
      .then((res) => res.json())
      .then((data) => setUnreadCount(data.count ?? 0))
      .catch(() => {})
      .finally(() => {
        fetchingRef.current = false;
      });
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchUnread();
  }, [fetchUnread]);

  // Re-fetch when tab becomes visible
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') fetchUnread();
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchUnread]);

  const markRead = useCallback(
    (opts?: { playlistId?: string; circleId?: string }) => {
      // Optimistically clear
      setUnreadCount(0);
      fetch('/api/activity/mark-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(opts ?? {}),
      })
        .then(() => fetchUnread())
        .catch(() => fetchUnread());
    },
    [fetchUnread]
  );

  return (
    <UnreadActivityContext.Provider value={{ unreadCount, refreshUnread: fetchUnread, markRead }}>
      {children}
    </UnreadActivityContext.Provider>
  );
}
