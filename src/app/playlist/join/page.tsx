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

  const [code, setCode] = useState(codeParam || '');
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="btn-pill btn-pill-primary w-full disabled:opacity-50"
              >
                {isJoining ? 'Joining...' : 'Join this Swaplist'}
              </button>
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
