'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { m } from 'motion/react';
import { toast } from 'sonner';
import { subscribeToPush } from '@/lib/push-client';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import { darken, rgbaCss } from '@/lib/color-extract';
import {
  Bell,
  Mail,
  LogOut,
  Music,
  Users,
  Heart,
  UserPlus,
  Disc3,
  ListMusic,
  Star,
  RotateCcw,
  Wand2,
  Pencil,
  Check,
  X,
} from 'lucide-react';
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

/** Map notification types to distinctive icons */
const NOTIFICATION_ICONS: Record<NotificationType, typeof Music> = {
  newTrack: Music,
  newSwaplist: ListMusic,
  memberJoined: UserPlus,
  reactions: Heart,
  trackRemoved: Disc3,
  circleJoined: Users,
  playlistFollowed: Star,
};

function ProfileContent({ user, stats }: ProfileClientProps) {
  const searchParams = useSearchParams();

  const [displayName, setDisplayName] = useState(user.displayName);
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.displayName);
  const [isSavingName, setIsSavingName] = useState(false);

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

  async function handleSaveName() {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === displayName) {
      setIsEditingName(false);
      setNameInput(displayName);
      return;
    }
    setIsSavingName(true);
    try {
      const res = await fetch('/api/profile/preferences', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: trimmed }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to update name');
      }
      setDisplayName(trimmed);
      setIsEditingName(false);
      toast.info('Name updated');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update name');
    } finally {
      setIsSavingName(false);
    }
  }

  // Detect browser notification permission and sync push toggle
  useEffect(() => {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      setBrowserPushState('unsupported');
      if (pushMaster) setPushMaster(false);
      return;
    }
    const perm = Notification.permission;
    setBrowserPushState(perm);
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

    if (user.email && emailInput.toLowerCase() === user.email.toLowerCase()) {
      setMessage({ type: 'error', text: 'This is already your verified email' });
      setIsSaving(false);
      return;
    }

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

  const avatarColors = useAlbumColors(user.avatarUrl);

  // Build page-level gradient from profile photo colors
  const pageGradient =
    avatarColors.isExtracted && avatarColors.colors
      ? (() => {
          const { primary, secondary } = avatarColors.colors;
          const dp = darken(primary, 0.5);
          const ds = darken(secondary, 0.35);
          return [
            `radial-gradient(ellipse 130% 50% at 50% 0%, ${rgbaCss(dp, 0.95)} 0%, transparent 70%)`,
            `radial-gradient(ellipse 90% 40% at 85% 5%, ${rgbaCss(ds, 0.6)} 0%, transparent 60%)`,
            `radial-gradient(ellipse 70% 30% at 15% 10%, ${rgbaCss(primary, 0.2)} 0%, transparent 50%)`,
          ].join(', ');
        })()
      : null;

  return (
    <div className={`min-h-screen relative ${pageGradient ? '' : 'gradient-bg'}`}>
      {/* Full-bleed page gradient from profile photo */}
      {pageGradient && (
        <div
          className="absolute top-0 sm:-top-20 bottom-0 left-1/2 w-screen -translate-x-1/2 pointer-events-none z-0"
          aria-hidden="true"
          style={{ backgroundImage: pageGradient }}
        />
      )}

      {/* ── Hero header ── */}
      <div className="relative z-1 px-5 pt-8 pb-7 flex flex-col items-center text-center">
        {/* Avatar with gradient ring */}
        <m.div
          className="relative z-10"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...springs.gentle, delay: 0.05 }}
        >
          <div className="absolute -inset-[3px] rounded-full bg-gradient-to-br from-brand via-accent-green/50 to-brand opacity-80" />
          {user.avatarUrl ? (
            <img
              src={user.avatarUrl}
              alt={user.displayName}
              className="relative w-20 h-20 rounded-full ring-2 ring-background object-cover"
            />
          ) : (
            <div className="relative w-20 h-20 rounded-full ring-2 ring-background bg-surface flex items-center justify-center text-2xl font-bold text-text-secondary">
              {user.displayName[0]}
            </div>
          )}
        </m.div>

        {/* Display name */}
        <m.div
          className="relative z-10 mt-3.5 flex items-center gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.1 }}
        >
          {isEditingName ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveName();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                className="input-glass text-center text-xl font-display font-semibold w-48"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                maxLength={50}
                autoFocus
                disabled={isSavingName}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsEditingName(false);
                    setNameInput(displayName);
                  }
                }}
              />
              <button
                type="submit"
                disabled={isSavingName}
                className="w-7 h-7 rounded-full bg-brand/20 hover:bg-brand/30 flex items-center justify-center transition-colors"
              >
                <Check className="w-3.5 h-3.5 text-brand" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditingName(false);
                  setNameInput(displayName);
                }}
                className="w-7 h-7 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-3.5 h-3.5 text-text-tertiary" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => setIsEditingName(true)}
              className="group flex items-center gap-2 cursor-pointer"
            >
              <h1 className="text-2xl font-display font-semibold text-text-primary">
                {displayName}
              </h1>
              <Pencil className="w-3.5 h-3.5 text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
        </m.div>

        {/* Stats row */}
        <m.div
          className="relative z-10 flex items-center gap-5 mt-3.5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.15 }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5 text-brand">
              <ListMusic className="w-3.5 h-3.5" />
              <span className="text-xl font-heading font-bold tabular-nums">{stats.jamCount}</span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-tertiary">
              Swaplists
            </span>
          </div>

          <div className="w-px h-8 bg-gradient-to-b from-transparent via-white/10 to-transparent" />

          <div className="flex flex-col items-center gap-0.5">
            <div className="flex items-center gap-1.5 text-accent-green">
              <Music className="w-3.5 h-3.5" />
              <span className="text-xl font-heading font-bold tabular-nums">
                {stats.trackCount}
              </span>
            </div>
            <span className="text-[10px] font-medium uppercase tracking-widest text-text-tertiary">
              Tracks Added
            </span>
          </div>
        </m.div>
      </div>

      {/* ── Settings sections ── */}
      <div className="relative z-1 px-5 py-4 space-y-4">
        {/* Notifications */}
        <m.div
          className="glass rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 8 }}
        >
          <SectionHeader label="Notifications" />
          <div className="px-4 pb-4 space-y-3">
            <div>
              <ToggleRow
                icon={<Bell className="w-[18px] h-[18px] text-brand" />}
                label="Push notifications"
                description="Browser & mobile push alerts"
                enabled={pushMaster}
                onChange={handlePushMasterToggle}
              />
              {browserPushState === 'denied' && (
                <p className="text-xs text-amber-400 mt-1.5 ml-9">
                  Notifications are blocked in your browser. Enable them in your browser/OS settings
                  to use push.
                </p>
              )}
              {browserPushState === 'unsupported' && (
                <p className="text-xs text-text-tertiary mt-1.5 ml-9">
                  Push notifications are not supported in this browser.
                </p>
              )}
            </div>

            <div className="h-px bg-white/[0.04]" />

            <div>
              <ToggleRow
                icon={<Mail className="w-[18px] h-[18px] text-brand" />}
                label="Email notifications"
                description="Email updates about your Swaplists"
                enabled={emailMaster}
                onChange={handleEmailMasterToggle}
              />

              {/* Email address management */}
              <div className="mt-3 ml-9 space-y-2">
                {message && (
                  <div
                    className={`rounded-xl px-3 py-2 text-sm ${
                      message.type === 'success'
                        ? 'bg-accent-green/10 border border-accent-green/20 text-accent-green'
                        : 'bg-danger/10 border border-danger/20 text-danger'
                    }`}
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
                      className="text-brand hover:text-brand-hover transition-colors"
                    >
                      Change
                    </button>
                  </div>
                )}

                {user.pendingEmail && !isEditing && (
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <span className="text-amber-400">{user.pendingEmail}</span>
                    <span className="text-text-tertiary">&middot;</span>
                    <span className="text-text-tertiary text-xs uppercase tracking-wide">
                      Verifying
                    </span>
                    <span className="text-text-tertiary">&middot;</span>
                    <button
                      onClick={handleResend}
                      disabled={isSaving}
                      className="text-brand hover:text-brand-hover transition-colors"
                    >
                      Resend
                    </button>
                    <button
                      onClick={handleCancel}
                      disabled={isSaving}
                      className="text-text-tertiary hover:text-danger transition-colors"
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
                    className="text-sm text-brand hover:text-brand-hover transition-colors flex items-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5" />
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
                      autoComplete="email"
                      enterKeyHint="send"
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
                      className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>
            </div>
            {/* Per-type toggles */}
            <div className="pt-1">
              <div className="flex items-center gap-3 my-3">
                <div className="h-px flex-1 bg-white/[0.06]" />
                <span className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
                  By type
                </span>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1 text-[11px] text-text-tertiary hover:text-text-secondary transition-colors"
                >
                  <RotateCcw className="w-2.5 h-2.5" />
                  Reset
                </button>
                <div className="h-px flex-1 bg-white/[0.06]" />
              </div>

              {/* Column headers */}
              <div className="flex items-center justify-end gap-3 mb-2 pr-0.5">
                <span className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary w-10 text-center">
                  Push
                </span>
                <span className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary w-10 text-center">
                  Email
                </span>
              </div>

              <div className="space-y-1">
                {NOTIFICATION_TYPES.map((type, i) => {
                  const Icon = NOTIFICATION_ICONS[type];
                  return (
                    <m.div
                      key={type}
                      className="flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 -mx-3 hover:bg-white/[0.02] transition-colors"
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ ...springs.gentle, delay: STAGGER_DELAY * 10 + i * 0.04 }}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center shrink-0">
                          <Icon className="w-4 h-4 text-text-secondary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-text-primary">
                            {NOTIFICATION_TYPE_LABELS[type].label}
                          </p>
                          <p className="text-xs text-text-tertiary truncate">
                            {NOTIFICATION_TYPE_LABELS[type].description}
                          </p>
                        </div>
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
                    </m.div>
                  );
                })}
              </div>
            </div>
          </div>
        </m.div>

        {/* Listening */}
        <m.div
          className="glass rounded-2xl overflow-hidden"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 16 }}
        >
          <SectionHeader label="Listening" />
          <div className="px-4 pb-4">
            <ToggleRow
              icon={<Wand2 className="w-[18px] h-[18px] text-accent-green" />}
              label="Auto-reactions"
              description="Skip = 👎, save to library = 👍"
              enabled={user.autoNegativeReactions}
              onChange={(v) => updatePreference('autoNegativeReactions', v)}
            />
          </div>
        </m.div>

        {/* Logout */}
        <m.form
          action="/api/auth/logout"
          method="POST"
          className="pt-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 20 }}
        >
          <button
            type="submit"
            className="btn-pill w-full flex items-center justify-center gap-2 text-danger/80 border border-danger/20 hover:border-danger/40 hover:text-danger hover:bg-danger/[0.06] transition-all"
          >
            <LogOut className="w-4 h-4" />
            Log out
          </button>
        </m.form>

        {/* Footer */}
        <m.p
          className="text-center text-xs text-text-tertiary pt-3 pb-2 tracking-wide"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.6 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 22 }}
        >
          Swapify &middot; Built with Spotify Web API
        </m.p>
      </div>
    </div>
  );
}

/* ─── Section header component ─── */
function SectionHeader({ label }: { label: string }) {
  return (
    <div className="px-4 pt-4 pb-3">
      <h3 className="text-[13px] font-heading font-semibold text-text-primary/70">{label}</h3>
    </div>
  );
}

/* ─── Toggle row with icon ─── */
function ToggleRow({
  icon,
  label,
  description,
  enabled,
  onChange,
}: {
  icon?: React.ReactNode;
  label: string;
  description: string;
  enabled: boolean;
  onChange?: (value: boolean) => Promise<boolean>;
}) {
  const [isOn, setIsOn] = useState(enabled);

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
      <div className="flex items-start gap-3 flex-1 min-w-0">
        {icon && <div className="mt-0.5 shrink-0">{icon}</div>}
        <div className="flex-1 min-w-0">
          <p className="text-[15px] font-medium text-text-primary leading-tight">{label}</p>
          <p className="text-sm text-text-tertiary mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      <button
        role="switch"
        aria-checked={isOn}
        aria-label={label}
        onClick={handleClick}
        className={`relative w-12 h-7 rounded-full transition-all duration-200 shrink-0 ${
          isOn ? 'bg-brand shadow-[0_0_12px_rgba(56,189,248,0.25)]' : 'bg-white/10'
        }`}
      >
        <div
          className={`absolute top-[3px] w-[22px] h-[22px] rounded-full shadow-sm transition-all duration-200 ${
            isOn ? 'translate-x-[23px] bg-white' : 'translate-x-[3px] bg-white/70'
          }`}
        />
      </button>
    </div>
  );
}

/* ─── Mini toggle for notification type grid ─── */
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
      className={`relative w-10 h-[22px] rounded-full transition-all duration-200 ${
        disabled
          ? 'bg-white/5 cursor-not-allowed'
          : enabled
            ? 'bg-brand shadow-[0_0_8px_rgba(56,189,248,0.2)]'
            : 'bg-white/10'
      }`}
    >
      <div
        className={`absolute top-[3px] w-4 h-4 rounded-full shadow-sm transition-all duration-200 ${
          disabled ? 'bg-white/20' : enabled ? 'bg-white' : 'bg-white/60'
        } ${enabled ? 'translate-x-[21px]' : 'translate-x-[3px]'}`}
      />
    </button>
  );
}

/* ─── Plus icon (small inline) ─── */
function Plus({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}
