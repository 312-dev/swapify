'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { m } from 'motion/react';
import { toast } from 'sonner';
import { subscribeToPush } from '@/lib/push-client';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import {
  NOTIFICATION_TYPES,
  NOTIFICATION_TYPE_LABELS,
  DEFAULT_NOTIFICATION_PREFS,
  parseNotificationPrefs,
  type NotificationType,
  type NotificationPrefs,
} from '@/lib/notification-prefs';

interface ProfileClientProps {
  user: {
    displayName: string;
    avatarUrl: string | null;
    email: string | null;
    pendingEmail: string | null;
    notifyPush: boolean;
    notifyEmail: boolean;
    notificationPrefs: string | null;
    autoNegativeReactions: boolean;
  };
  stats: {
    jamCount: number;
    trackCount: number;
  };
}

export default function ProfileClient(props: ProfileClientProps) {
  return (
    <Suspense fallback={<div className="min-h-screen gradient-bg" />}>
      <ProfileContent {...props} />
    </Suspense>
  );
}

async function updatePreference(key: string, value: boolean): Promise<boolean> {
  try {
    const res = await fetch('/api/profile/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    });
    if (!res.ok) throw new Error();
    return true;
  } catch {
    toast.error('Failed to save preference');
    return false;
  }
}

async function updateNotificationPref(
  type: NotificationType,
  channel: 'push' | 'email',
  value: boolean
): Promise<boolean> {
  try {
    const res = await fetch('/api/profile/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        notificationPrefs: { [type]: { [channel]: value } },
      }),
    });
    if (!res.ok) throw new Error();
    return true;
  } catch {
    toast.error('Failed to save preference');
    return false;
  }
}

async function resetNotificationPrefs(): Promise<boolean> {
  try {
    const res = await fetch('/api/profile/preferences', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resetNotificationPrefs: true }),
    });
    if (!res.ok) throw new Error();
    return true;
  } catch {
    toast.error('Failed to reset preferences');
    return false;
  }
}

function ProfileContent({ user, stats }: ProfileClientProps) {
  const searchParams = useSearchParams();

  const [emailInput, setEmailInput] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [prefs, setPrefs] = useState<NotificationPrefs>(() =>
    parseNotificationPrefs(user.notificationPrefs)
  );
  const [pushMaster, setPushMaster] = useState(user.notifyPush);
  const [emailMaster, setEmailMaster] = useState(user.notifyEmail);
  const [browserPushState, setBrowserPushState] = useState<
    'granted' | 'denied' | 'default' | 'unsupported' | null
  >(null);

  // Detect browser notification permission and sync push toggle
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setBrowserPushState('unsupported');
      if (pushMaster) setPushMaster(false);
      return;
    }
    const perm = Notification.permission;
    setBrowserPushState(perm);
    // If DB says push is on but browser hasn't granted permission, show as off
    if (perm !== 'granted' && pushMaster) {
      setPushMaster(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  async function handlePushMasterToggle(enabled: boolean): Promise<boolean> {
    if (enabled) {
      if (!('Notification' in window) || !('serviceWorker' in navigator)) {
        toast.error('Push notifications are not supported in this browser');
        return false;
      }

      if (Notification.permission === 'default') {
        const result = await Notification.requestPermission();
        setBrowserPushState(result);
        if (result !== 'granted') {
          toast.error('Notification permission denied');
          return false;
        }
        await subscribeToPush();
      } else if (Notification.permission === 'denied') {
        toast.error('Notifications are blocked. Enable them in your browser settings.');
        return false;
      } else if (Notification.permission === 'granted') {
        await subscribeToPush();
      }
    }

    const success = await updatePreference('notifyPush', enabled);
    if (success) setPushMaster(enabled);
    return success;
  }

  async function handleEmailMasterToggle(enabled: boolean): Promise<boolean> {
    const success = await updatePreference('notifyEmail', enabled);
    if (success) setEmailMaster(enabled);
    return success;
  }

  async function handleTypePrefToggle(
    type: NotificationType,
    channel: 'push' | 'email',
    value: boolean
  ) {
    const prev = prefs[type][channel];
    setPrefs((p) => ({
      ...p,
      [type]: { ...p[type], [channel]: value },
    }));

    const success = await updateNotificationPref(type, channel, value);
    if (!success) {
      setPrefs((p) => ({
        ...p,
        [type]: { ...p[type], [channel]: prev },
      }));
    }
  }

  async function handleReset() {
    const success = await resetNotificationPrefs();
    if (success) {
      setPrefs({ ...DEFAULT_NOTIFICATION_PREFS });
      toast.info('Notification preferences reset to defaults');
    }
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <div className="gradient-bg-radial px-5 pt-10 pb-8 flex flex-col items-center text-center">
        <m.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springs.gentle, delay: 0.05 }}
        >
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="w-24 h-24 rounded-full mb-4 shadow-xl glow-brand"
            />
          ) : (
            <div className="w-24 h-24 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold text-text-secondary mb-4 glow-brand">
              {user.displayName[0]}
            </div>
          )}
        </m.div>
        <m.h1
          className="text-3xl font-bold text-text-primary"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.1 }}
        >
          {user.displayName}
        </m.h1>

        {/* Stats */}
        <m.div
          className="flex items-center gap-6 mt-4"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.15 }}
        >
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{stats.jamCount}</p>
            <p className="text-sm text-text-secondary">Swaplists</p>
          </div>
          <div className="w-px h-8 bg-white/10" />
          <div className="text-center">
            <p className="text-xl font-bold text-text-primary">{stats.trackCount}</p>
            <p className="text-sm text-text-secondary">Tracks Added</p>
          </div>
        </m.div>
      </div>

      {/* Settings sections */}
      <div className="px-5 py-6 space-y-4">
        {/* Notification Channels */}
        <m.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 8 }}
        >
          <h3 className="text-base font-semibold text-text-primary uppercase tracking-wider mb-4">
            Notification Channels
          </h3>
          <div className="space-y-4">
            <div>
              <ToggleRow
                label="Push notifications"
                description="Browser & mobile push alerts"
                enabled={pushMaster}
                onChange={handlePushMasterToggle}
              />
              {browserPushState === 'denied' && (
                <p className="text-xs text-amber-400 mt-1.5 ml-0.5">
                  Notifications are blocked in your browser. Enable them in your browser/OS settings
                  to use push.
                </p>
              )}
              {browserPushState === 'unsupported' && (
                <p className="text-xs text-text-tertiary mt-1.5 ml-0.5">
                  Push notifications are not supported in this browser.
                </p>
              )}
            </div>

            <div>
              <ToggleRow
                label="Email notifications"
                description="Email updates about your Swaplists"
                enabled={emailMaster}
                onChange={handleEmailMasterToggle}
              />

              {/* Email address management */}
              <div className="mt-3 ml-0.5 space-y-2">
                {message && (
                  <div
                    className={
                      message.type === 'success'
                        ? 'bg-brand/10 border border-brand/20 rounded-lg px-3 py-2 text-sm text-brand'
                        : 'bg-danger/10 border border-danger/20 rounded-lg px-3 py-2 text-sm text-danger'
                    }
                  >
                    {message.text}
                  </div>
                )}

                {user.email && !isEditing && (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-text-tertiary">{user.email}</span>
                    <button
                      onClick={() => {
                        setIsEditing(true);
                        setEmailInput('');
                        setMessage(null);
                      }}
                      className="text-brand hover:underline"
                    >
                      Change
                    </button>
                  </div>
                )}

                {user.pendingEmail && !isEditing && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-amber-400">{user.pendingEmail}</span>
                    <span className="text-text-tertiary">·</span>
                    <span className="text-text-tertiary">Verifying</span>
                    <span className="text-text-tertiary">·</span>
                    <button
                      onClick={handleResend}
                      disabled={isSaving}
                      className="text-brand hover:underline"
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

                {!user.email && !user.pendingEmail && !isEditing && (
                  <button
                    onClick={() => {
                      setIsEditing(true);
                      setMessage(null);
                    }}
                    className="text-sm text-brand hover:underline"
                  >
                    Add email address
                  </button>
                )}

                {isEditing && (
                  <form onSubmit={handleSubmit} className="flex items-center gap-2">
                    <input
                      type="email"
                      className="input-glass input-glass-sm flex-1"
                      placeholder="your@email.com"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      required
                      autoFocus
                    />
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="btn-pill-primary btn-pill-sm"
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
        </m.div>

        {/* Notification Types */}
        <m.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 12 }}
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-semibold text-text-primary uppercase tracking-wider">
              Notification Types
            </h3>
            <button
              onClick={handleReset}
              className="text-sm text-text-tertiary hover:text-text-secondary transition-colors"
            >
              Reset defaults
            </button>
          </div>

          {/* Column headers */}
          <div className="flex items-center justify-end gap-3 mb-3 pr-0.5">
            <span className="text-sm text-text-tertiary w-10 text-center">Push</span>
            <span className="text-sm text-text-tertiary w-10 text-center">Email</span>
          </div>

          <div className="space-y-3">
            {NOTIFICATION_TYPES.map((type) => (
              <div key={type} className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {NOTIFICATION_TYPE_LABELS[type].label}
                  </p>
                  <p className="text-sm text-text-tertiary">
                    {NOTIFICATION_TYPE_LABELS[type].description}
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  <MiniToggle
                    enabled={prefs[type].push}
                    disabled={!pushMaster}
                    onChange={(v) => handleTypePrefToggle(type, 'push', v)}
                    label={`${NOTIFICATION_TYPE_LABELS[type].label} push`}
                  />
                  <MiniToggle
                    enabled={prefs[type].email}
                    disabled={!emailMaster}
                    onChange={(v) => handleTypePrefToggle(type, 'email', v)}
                    label={`${NOTIFICATION_TYPE_LABELS[type].label} email`}
                  />
                </div>
              </div>
            ))}
          </div>
        </m.div>

        {/* Listening */}
        <m.div
          className="glass rounded-2xl p-5"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 16 }}
        >
          <h3 className="text-base font-semibold text-text-primary uppercase tracking-wider mb-4">
            Listening
          </h3>
          <ToggleRow
            label="Auto-reactions"
            description="Automatically react based on behavior (skip = thumbs down, save to library = thumbs up)"
            enabled={user.autoNegativeReactions}
            onChange={(v) => updatePreference('autoNegativeReactions', v)}
          />
        </m.div>

        {/* Logout */}
        <m.form
          action="/api/auth/logout"
          method="POST"
          className="pt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 20 }}
        >
          <button
            type="submit"
            className="btn-pill w-full text-danger border border-danger/30 hover:bg-danger/10 transition-colors"
          >
            Log out
          </button>
        </m.form>

        <p className="text-center text-sm text-text-secondary pt-2">
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
  onChange,
}: {
  label: string;
  description: string;
  enabled: boolean;
  onChange?: (value: boolean) => Promise<boolean>;
}) {
  const [isOn, setIsOn] = useState(enabled);

  // Sync with parent state (e.g. when browser permission check overrides pushMaster)
  useEffect(() => {
    setIsOn(enabled);
  }, [enabled]);

  async function handleClick() {
    const next = !isOn;
    setIsOn(next);

    if (onChange) {
      const success = await onChange(next);
      if (!success) {
        setIsOn(!next);
      }
    }
  }

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <p className="text-base font-medium text-text-primary">{label}</p>
        <p className="text-sm text-text-secondary mt-0.5">{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={isOn}
        aria-label={label}
        onClick={handleClick}
        className={`relative w-11 h-6 rounded-full transition-colors duration-200 shrink-0 ${
          isOn ? 'bg-brand' : 'bg-white/10'
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

function MiniToggle({
  enabled,
  disabled,
  onChange,
  label,
}: {
  enabled: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      role="switch"
      aria-checked={enabled}
      aria-label={label}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!enabled);
      }}
      className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
        disabled ? 'bg-white/5 cursor-not-allowed' : enabled ? 'bg-brand' : 'bg-white/10'
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-all duration-200 ${
          disabled ? 'bg-white/20' : 'bg-white'
        } ${enabled ? 'translate-x-[21px]' : 'translate-x-0.5'}`}
      />
    </button>
  );
}
