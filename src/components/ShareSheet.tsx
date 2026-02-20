'use client';

import { useState } from 'react';
import GlassDrawer from '@/components/ui/glass-drawer';

interface ShareSheetProps {
  isOpen: boolean;
  onClose: () => void;
  circleInviteCode: string;
  circleName: string;
  circleId: string;
}

export default function ShareSheet({
  isOpen,
  onClose,
  circleInviteCode,
  circleName,
  circleId,
}: ShareSheetProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  const inviteUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/circle/join?code=${circleInviteCode}`
      : '';

  function handleCopyCode() {
    navigator.clipboard.writeText(circleInviteCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  function handleCopyLink() {
    navigator.clipboard.writeText(inviteUrl);
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  }

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: `Join "${circleName}" on Swapify`,
        text: `Join my circle on Swapify! Use code: ${circleInviteCode}`,
        url: inviteUrl,
      });
    } catch {
      // User cancelled or not supported — fall through to copy
      handleCopyLink();
    }
  }

  async function handleSendEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;

    setSending(true);
    setEmailStatus(null);

    try {
      const res = await fetch(`/api/circles/${circleId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (res.ok) {
        setEmailStatus({ type: 'success', message: 'Invite sent!' });
        setEmail('');
      } else {
        setEmailStatus({
          type: 'error',
          message: data.error || 'Failed to send invite.',
        });
      }
    } catch {
      setEmailStatus({
        type: 'error',
        message: 'Something went wrong. Try again.',
      });
    } finally {
      setSending(false);
    }
  }

  function handleClose() {
    setEmailStatus(null);
    setEmail('');
    setCodeCopied(false);
    setLinkCopied(false);
    onClose();
  }

  const canNativeShare = typeof navigator !== 'undefined' && !!navigator.share;

  return (
    <GlassDrawer isOpen={isOpen} onClose={handleClose} title="Invite to Circle" snapPoint="half">
      <div className="space-y-5">
        {/* Invite code — front and center */}
        <div>
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 block">
            Invite code
          </label>
          <button
            onClick={handleCopyCode}
            className="w-full glass rounded-xl p-4 flex items-center justify-between gap-3 active:scale-[0.98] transition-transform"
          >
            <span className="text-2xl font-mono font-bold tracking-widest text-text-primary select-all">
              {circleInviteCode}
            </span>
            <span className="shrink-0 text-sm text-text-secondary">
              {codeCopied ? (
                <svg
                  className="w-5 h-5 text-brand"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                'Tap to copy'
              )}
            </span>
          </button>
          <p className="text-sm text-text-tertiary mt-1.5">
            Share this code so friends can join your circle
          </p>
        </div>

        {/* Native share (mobile) */}
        {canNativeShare && (
          <button
            onClick={handleNativeShare}
            className="btn-pill-secondary w-full justify-center gap-2"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
              />
            </svg>
            Share via...
          </button>
        )}

        {/* Divider */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/10" />
          <span className="text-sm text-text-tertiary">or share via link / email</span>
          <div className="flex-1 h-px bg-white/10" />
        </div>

        {/* Link section */}
        <div>
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 block">
            Invite link
          </label>
          <div className="flex gap-2">
            <div className="flex-1 input-glass input-glass-sm text-sm truncate select-all">
              {inviteUrl}
            </div>
            <button onClick={handleCopyLink} className="btn-pill-secondary btn-pill-sm shrink-0">
              {linkCopied ? (
                <svg
                  className="w-4 h-4 text-brand"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                'Copy'
              )}
            </button>
          </div>
        </div>

        {/* Email invite */}
        <form onSubmit={handleSendEmail}>
          <label className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2 block">
            Email invite
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailStatus(null);
              }}
              className="input-glass flex-1 text-sm"
              required
            />
            <button
              type="submit"
              disabled={sending || !email.trim()}
              className="btn-pill-primary btn-pill-sm shrink-0 disabled:opacity-50"
            >
              {sending ? 'Sending...' : 'Send'}
            </button>
          </div>
          {emailStatus && (
            <p
              className={`text-sm mt-2 ${
                emailStatus.type === 'success' ? 'text-brand' : 'text-red-400'
              }`}
            >
              {emailStatus.message}
            </p>
          )}
        </form>
      </div>
    </GlassDrawer>
  );
}
