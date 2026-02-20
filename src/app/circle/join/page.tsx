'use client';

import { Suspense, useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { m } from 'motion/react';
import { Users, Crown, AlertCircle, ArrowLeft } from 'lucide-react';
import { springs, STAGGER_DELAY } from '@/lib/motion';

interface CirclePreview {
  id: string;
  name: string;
  hostName: string;
  memberCount: number;
  spotifyClientId: string;
}

interface InvitePreview extends CirclePreview {
  recipientEmail?: string;
}

export default function JoinCirclePage() {
  return (
    <Suspense>
      <JoinCircleContent />
    </Suspense>
  );
}

function JoinCircleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const codeParam = searchParams.get('code');
  const inviteParam = searchParams.get('invite');

  const [code, setCode] = useState(codeParam || '');
  const [inviteToken, setInviteToken] = useState(inviteParam || '');
  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-lookup when code or invite param is present
  useEffect(() => {
    if (inviteParam) {
      lookupInvite(inviteParam);
    } else if (codeParam) {
      lookupCode(codeParam);
    }
  }, [codeParam, inviteParam]);

  async function lookupCode(inviteCode: string) {
    setIsLoading(true);
    setError(null);
    setPreview(null);

    try {
      const res = await fetch(`/api/circles/resolve?code=${encodeURIComponent(inviteCode)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite code');
      }
      const circle: CirclePreview = await res.json();
      setPreview(circle);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setIsLoading(false);
    }
  }

  async function lookupInvite(token: string) {
    setIsLoading(true);
    setError(null);
    setPreview(null);
    try {
      const res = await fetch(`/api/circles/resolve-invite?token=${encodeURIComponent(token)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite link');
      }
      const data: InvitePreview = await res.json();
      setPreview(data);
      setInviteToken(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid invite link');
    } finally {
      setIsLoading(false);
    }
  }

  function handleJoin() {
    if (!preview) return;
    setIsJoining(true);

    // Joining a circle ALWAYS requires OAuth with the circle's Spotify client ID,
    // even if the user is already logged in. The OAuth callback handles creating
    // the circle_members entry.
    let loginUrl =
      `/api/auth/login?clientId=${encodeURIComponent(preview.spotifyClientId)}` +
      `&circleAction=join` +
      `&circleId=${encodeURIComponent(preview.id)}` +
      `&returnTo=${encodeURIComponent('/dashboard')}`;

    // Pass invite token for email auto-verify
    if (inviteToken) {
      loginUrl += `&inviteToken=${encodeURIComponent(inviteToken)}`;
    }

    window.location.href = loginUrl;
  }

  return (
    <main className="gradient-bg min-h-screen flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        <m.h1
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          className="text-2xl font-bold text-text-primary text-center mb-8"
        >
          Join a Circle
        </m.h1>

        {/* Loading state */}
        {isLoading && (
          <m.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springs.snappy}
            className="text-center"
          >
            <div className="glass rounded-xl p-8 flex flex-col items-center gap-3">
              <svg className="w-6 h-6 animate-spin text-brand" viewBox="0 0 24 24" fill="none">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="3"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <p className="text-base text-text-secondary">Looking up invite code...</p>
            </div>
          </m.div>
        )}

        {/* Code entry form (no code param, or lookup failed) */}
        {!isLoading && !preview && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.gentle}
            className="space-y-4"
          >
            <div>
              <label
                htmlFor="circle-code"
                className="block text-base font-medium text-text-secondary mb-2"
              >
                Invite code
              </label>
              <div className="flex gap-2">
                <input
                  id="circle-code"
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Enter invite code"
                  className="input-glass flex-1"
                />
                <button
                  onClick={() => lookupCode(code.trim())}
                  disabled={!code.trim() || isLoading}
                  className="btn-pill btn-pill-primary disabled:opacity-50"
                >
                  Find
                </button>
              </div>
            </div>

            {error && (
              <m.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={springs.snappy}
                className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-base text-danger flex items-start gap-2"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <span>{error}</span>
              </m.div>
            )}

            <button
              onClick={() => router.push('/dashboard')}
              className="text-base text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to dashboard
            </button>
          </m.div>
        )}

        {/* Circle preview */}
        {!isLoading && preview && (
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.gentle}
            className="space-y-6"
          >
            <div className="glass rounded-xl p-8 text-center">
              {/* Circle icon */}
              <m.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ ...springs.snappy, delay: STAGGER_DELAY * 1 }}
                className="w-16 h-16 rounded-full bg-brand/15 flex items-center justify-center mx-auto mb-4"
              >
                <Users className="w-8 h-8 text-brand" />
              </m.div>

              {/* Circle name */}
              <m.h2
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: STAGGER_DELAY * 2 }}
                className="text-xl font-semibold text-text-primary mb-1"
              >
                {preview.name}
              </m.h2>

              {/* Host + member count */}
              <m.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: STAGGER_DELAY * 3 }}
                className="flex items-center justify-center gap-2 text-sm text-text-secondary mb-5"
              >
                <span className="inline-flex items-center gap-1">
                  <Crown className="w-3.5 h-3.5 text-brand" />
                  {preview.hostName}
                </span>
                <span>&middot;</span>
                <span>
                  {preview.memberCount} member{preview.memberCount !== 1 ? 's' : ''}
                </span>
              </m.div>

              {/* Invited email */}
              {preview.recipientEmail && (
                <m.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: STAGGER_DELAY * 3.5 }}
                  className="text-xs text-text-secondary mb-4"
                >
                  Invited as{' '}
                  <span className="font-medium text-text-primary">{preview.recipientEmail}</span>
                </m.p>
              )}

              {/* Join button */}
              <m.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: STAGGER_DELAY * 4 }}
              >
                <button
                  onClick={handleJoin}
                  disabled={isJoining}
                  className="btn-pill w-full bg-accent-green hover:bg-accent-green/90 text-black font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isJoining ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="3"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      Connecting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                      </svg>
                      Join with Spotify
                    </>
                  )}
                </button>
              </m.div>

              {/* Dev mode note */}
              <m.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ ...springs.gentle, delay: STAGGER_DELAY * 5 }}
                className="text-xs text-text-tertiary mt-4 leading-relaxed"
              >
                Your host may need to add your Spotify email to their developer app before you can
                connect.
              </m.p>
            </div>

            {/* Use different code */}
            <button
              onClick={() => {
                setPreview(null);
                setCode('');
                setError(null);
              }}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              Use a different code
            </button>
          </m.div>
        )}
      </div>
    </main>
  );
}
