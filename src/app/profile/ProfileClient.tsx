'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';

interface ProfileClientProps {
  user: {
    displayName: string;
    avatarUrl: string | null;
    email: string | null;
    pendingEmail: string | null;
    notifyPush: number;
    notifyEmail: number;
    autoNegativeReactions: number;
  };
  stats: {
    jamCount: number;
    trackCount: number;
  };
}

export default function ProfileClient(props: ProfileClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <ProfileContent {...props} />
    </Suspense>
  );
}

function ProfileContent({ user, stats }: ProfileClientProps) {
  const searchParams = useSearchParams();

  const [emailInput, setEmailInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    const emailVerified = searchParams.get('emailVerified');
    const emailError = searchParams.get('emailError');

    if (emailVerified === '1') {
      setMessage({ type: 'success', text: 'Email verified successfully!' });
    } else if (emailError) {
      setMessage({
        type: 'error',
        text: 'Verification link expired or invalid. Please try again.',
      });
    }

    if (emailVerified || emailError) {
      window.history.replaceState({}, '', '/profile');
    }
  }, [searchParams]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to send verification email');
      }
      setMessage({ type: 'success', text: 'Check your inbox to verify your email.' });
      setIsEditing(false);
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleResend() {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.pendingEmail }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to resend verification email');
      }
      setMessage({ type: 'success', text: 'Verification email resent!' });
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong',
      });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCancel() {
    setIsSaving(true);
    try {
      const res = await fetch('/api/profile/email', { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to cancel verification');
      }
      window.location.href = '/profile';
    } catch (err) {
      setMessage({
        type: 'error',
        text: err instanceof Error ? err.message : 'Something went wrong',
      });
      setIsSaving(false);
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="gradient-bg-radial px-5 pt-10 pb-8 flex flex-col items-center text-center">
        {user.avatarUrl ? (
          <img
            src={user.avatarUrl}
            alt={user.displayName}
            className="w-24 h-24 rounded-full mb-4 shadow-xl"
          />
        ) : (
          <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold text-text-secondary mb-4">
            {user.displayName[0]}
          </div>
        )}
        <h1 className="text-3xl font-bold text-text-primary">{user.displayName}</h1>

        {/* Stats */}
        <div className="flex items-center gap-6 mt-4">
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{stats.jamCount}</p>
            <p className="text-sm text-text-tertiary">Swaplists</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{stats.trackCount}</p>
            <p className="text-sm text-text-tertiary">Tracks Added</p>
          </div>
        </div>
      </div>

      {/* Settings sections */}
      <div className="px-5 py-6 space-y-4">
        <div className="glass rounded-2xl p-5">
          <h3 className="text-base font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Notifications
          </h3>
          <div className="space-y-4">
            <ToggleRow
              label="Push notifications"
              description="Get notified when new tracks are added"
              enabled={user.notifyPush === 1}
            />

            <div>
              <ToggleRow
                label="Email notifications"
                description="Receive email updates about your digs"
                enabled={user.notifyEmail === 1}
              />

              {/* Email address management — inline under the toggle */}
              <div className="mt-3 ml-0.5 space-y-2">
                {message && (
                  <div
                    className={
                      message.type === 'success'
                        ? 'bg-spotify/10 border border-spotify/20 rounded-lg px-3 py-2 text-sm text-spotify'
                        : 'bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-sm text-danger'
                    }
                  >
                    {message.text}
                  </div>
                )}

                {/* Verified email */}
                {user.email && !isEditing && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-tertiary">{user.email}</span>
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setEmailInput('');
                        setMessage(null);
                      }}
                      className="text-spotify hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Pending verification */}
                {user.pendingEmail && !isEditing && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-amber-400">{user.pendingEmail}</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-text-tertiary">Verifying</span>
                    <span className="text-text-tertiary">·</span>
                    <button
                      onClick={handleResend}
                      disabled={isSaving}
                      className="text-spotify hover:underline"
                    >
                      Resend
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="text-text-tertiary hover:text-danger hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}

                {/* No email — prompt */}
                {!user.email && !user.pendingEmail && !isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setMessage(null);
                    }}
                    className="text-sm text-spotify hover:underline"
                  >
                    Add email address
                  </button>
                )}

                {/* Inline edit form */}
                {isEditing && (
                  <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                      type="email"
                      className="input-glass flex-1 py-2! px-3! text-sm! rounded-lg!"
                      placeholder="your@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn-pill-primary py-2! px-4! text-sm! rounded-lg!"
                    >
                      {isSaving ? '...' : 'Verify'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(false);
                        setMessage(null);
                      }}
                      className="text-sm text-text-tertiary hover:text-text-primary"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="text-base font-semibold text-text-secondary uppercase tracking-wider mb-4">
            Listening
          </h3>
          <ToggleRow
            label="Auto-reactions"
            description="Automatically react based on listening behavior (skip = thumbs down, full listen = thumbs up)"
            enabled={user.autoNegativeReactions === 1}
          />
        </div>

        {/* Logout */}
        <form action="/api/auth/logout" method="POST" className="pt-4">
          <button
            type="submit"
            className="btn-pill w-full text-danger border border-danger/30 hover:bg-danger/10 transition-colors"
          >
            Log out
          </button>
        </form>

        <p className="text-center text-sm text-text-tertiary pt-2">
          Swapify · Built with Spotify Web API
        </p>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  enabled,
}: {
  label: string;
  description: string;
  enabled: boolean;
}) {
  const [isOn, setIsOn] = useState(enabled);

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-tertiary mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => setIsOn(!isOn)}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 ${
          isOn ? 'bg-spotify' : 'bg-white/10'
        }`}
      >
        <div
          className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
            isOn ? 'translate-x-[22px]' : 'translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
