'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface PlaylistPreview {
  id: string;
  name: string;
  description: string | null;
  owner: { displayName: string; avatarUrl: string | null };
  memberCount: number;
  members: Array<{ displayName: string; avatarUrl: string | null }>;
  inviteCode: string;
}

export default function JoinPlaylistPage() {
  return (
    <Suspense>
      <JoinPlaylistContent />
    </Suspense>
  );
}

function JoinPlaylistContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code');
  const cidParam = searchParams.get('cid');

  const [code, setCode] = useState(codeParam || '');
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // If no code param, redirect to dashboard
  useEffect(() => {
    if (!codeParam) {
      router.replace('/dashboard');
    }
  }, [codeParam, router]);

  useEffect(() => {
    if (codeParam) {
      lookupCode(codeParam);
    }
  }, [codeParam]);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => setIsAuthenticated(res.ok))
      .catch(() => setIsAuthenticated(false));
  }, []);

  async function lookupCode(inviteCode: string) {
    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch(`/api/playlists/resolve?code=${encodeURIComponent(inviteCode)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite code');
      }
      const playlist = await res.json();
      setPreview(playlist);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleJoin() {
    if (!preview) return;
    setIsJoining(true);
    setError(null);

    try {
      const res = await fetch(`/api/playlists/${preview.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: preview.inviteCode }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          // Not authenticated — redirect to login with returnTo
          const returnTo = `/playlist/join?code=${preview.inviteCode}${cidParam ? `&cid=${cidParam}` : ''}`;
          const loginUrl = `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}${cidParam ? `&clientId=${cidParam}` : ''}`;
          window.location.href = loginUrl;
          return;
        }
        const data = await res.json();
        throw new Error(data.error || 'Failed to join');
      }

      router.push(`/playlist/${preview.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join');
      setIsJoining(false);
    }
  }

  // Don't render anything if redirecting
  if (!codeParam) return null;

  return (
    <main className="gradient-bg min-h-screen flex flex-col items-center justify-center px-5 py-6">
      <div className="w-full max-w-md">
        <h1 className="text-3xl font-bold text-text-primary text-center mb-6">Join a Swaplist</h1>

        {isLoading && (
          <div className="text-center">
            <p className="text-base text-text-secondary">Looking up invite code...</p>
          </div>
        )}

        {!isLoading && !preview && (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="code"
                className="block text-base font-medium text-text-secondary mb-2"
              >
                Invite code
              </label>
              <div className="flex gap-2">
                <input
                  id="code"
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter invite code"
                  className="input-glass flex-1"
                />
                <button
                  onClick={() => lookupCode(code)}
                  disabled={!code.trim() || isLoading}
                  className="btn-pill btn-pill-primary disabled:opacity-50"
                >
                  Find
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-base text-danger">
                {error}
              </div>
            )}

            <button
              onClick={() => router.push('/dashboard')}
              className="text-base text-text-secondary hover:text-text-primary transition-colors"
            >
              Back to dashboard
            </button>
          </div>
        )}

        {!isLoading && preview && (
          <div className="space-y-4">
            <div className="glass rounded-xl p-5 text-center">
              <h2 className="text-xl font-semibold text-text-primary mb-1">{preview.name}</h2>
              {preview.description && (
                <p className="text-base text-text-secondary mb-3">{preview.description}</p>
              )}
              <p className="text-base text-text-secondary mb-3">
                Created by {preview.owner.displayName} &middot; {preview.memberCount} member
                {preview.memberCount !== 1 ? 's' : ''}
              </p>

              {/* Member avatars */}
              <div className="flex justify-center mb-4">
                <div className="avatar-stack flex">
                  {preview.members.slice(0, 5).map((m, i) =>
                    m.avatarUrl ? (
                      <img
                        key={i}
                        src={m.avatarUrl}
                        alt={m.displayName}
                        className="w-8 h-8 rounded-full"
                        data-tooltip={m.displayName}
                      />
                    ) : (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm text-text-secondary"
                        data-tooltip={m.displayName}
                      >
                        {m.displayName[0]}
                      </div>
                    )
                  )}
                </div>
              </div>

              {isAuthenticated === false ? (
                <div className="space-y-3">
                  <p className="text-sm text-text-secondary text-center">
                    Connect with Spotify to join this Swaplist
                  </p>
                  {cidParam && (
                    <p className="text-xs text-text-tertiary text-center">
                      Your host may need to add your Spotify email to their developer app for web
                      app access.
                    </p>
                  )}
                  <a
                    href={`/api/auth/login?${cidParam ? `clientId=${cidParam}&` : ''}returnTo=${encodeURIComponent(`/playlist/join?code=${codeParam}${cidParam ? `&cid=${cidParam}` : ''}`)}`}
                    className="btn-pill btn-pill-primary w-full flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                    </svg>
                    Connect with Spotify
                  </a>
                </div>
              ) : (
                <button
                  onClick={handleJoin}
                  disabled={isJoining || isAuthenticated === null}
                  className="btn-pill btn-pill-primary w-full disabled:opacity-50"
                >
                  {isJoining ? 'Joining...' : 'Join this Swaplist'}
                </button>
              )}
            </div>

            {error && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-base text-danger">
                {error}
              </div>
            )}

            <button
              onClick={() => {
                setPreview(null);
                setCode('');
              }}
              className="text-base text-text-secondary hover:text-text-primary transition-colors"
            >
              Use a different code
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
