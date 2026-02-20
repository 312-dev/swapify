'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface ReauthOverlayProps {
  spotifyClientId?: string;
  circleId?: string;
}

export default function ReauthOverlay({ spotifyClientId, circleId }: ReauthOverlayProps) {
  const params = new URLSearchParams({ returnTo: '/dashboard' });
  if (spotifyClientId) params.set('clientId', spotifyClientId);
  if (circleId) params.set('circleId', circleId);
  const reauthUrl = `/api/auth/login?${params}`;

  return (
    <AlertDialog open>
      <AlertDialogContent className="bg-[#1a1a1a]! border-white/10" size="sm">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-red-500/20">
            <svg
              className="w-8 h-8 text-red-400"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </AlertDialogMedia>
          <AlertDialogTitle>Spotify Disconnected</AlertDialogTitle>
          <AlertDialogDescription>
            Your Spotify session has expired or been revoked. Reconnect to continue using Swapify.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={() => {
              globalThis.location.href = reauthUrl;
            }}
          >
            Reconnect Spotify
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
