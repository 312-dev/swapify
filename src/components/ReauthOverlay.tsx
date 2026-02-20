'use client';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div className="glass rounded-2xl p-8 mx-6 max-w-sm w-full text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
          <svg
            className="w-7 h-7 text-red-400"
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
        </div>
        <h2 className="text-xl font-semibold text-text-primary">Spotify Disconnected</h2>
        <p className="text-sm text-text-secondary">
          Your Spotify session has expired or been revoked. Reconnect to continue using Swapify.
        </p>
        <a href={reauthUrl} className="btn-pill btn-pill-primary w-full inline-block text-center">
          Reconnect Spotify
        </a>
      </div>
    </div>
  );
}
