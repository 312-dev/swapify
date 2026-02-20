'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { m } from 'motion/react';
import { Mail, CheckCircle, LogOut, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { springs } from '@/lib/motion';

interface VerifyEmailClientProps {
  displayName: string;
  avatarUrl: string | null;
  pendingEmail: string | null;
}

type ViewState = 'enter-email' | 'pending';

export default function VerifyEmailClient({
  displayName,
  avatarUrl,
  pendingEmail,
}: VerifyEmailClientProps) {
  const firstName = displayName.split(' ')[0] ?? displayName;
  const [view, setView] = useState<ViewState>(pendingEmail ? 'pending' : 'enter-email');
  const [email, setEmail] = useState('');
  const [submittedEmail, setSubmittedEmail] = useState(pendingEmail ?? '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll for verification when in pending state
  const startPolling = useCallback(() => {
    // Clear any existing interval
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) return;
        const data = await res.json();
        if (data.emailVerified) {
          if (pollRef.current) clearInterval(pollRef.current);
          window.location.href = '/dashboard';
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 5000);
  }, []);

  useEffect(() => {
    if (view === 'pending') {
      startPolling();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [view, startPolling]);

  async function handleSubmitEmail(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to send verification email');
      }

      setSubmittedEmail(email.trim());
      setView('pending');
      setEmail('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    setIsLoading(true);

    try {
      const res = await fetch('/api/profile/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: submittedEmail }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to resend verification email');
      }

      toast.success('Verification email resent!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to resend email');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUseDifferentEmail() {
    setIsLoading(true);

    try {
      const res = await fetch('/api/profile/email', { method: 'DELETE' });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || 'Failed to cancel verification');
      }

      setSubmittedEmail('');
      setView('enter-email');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-dvh gradient-bg-radial flex flex-col items-center justify-center px-5 py-10">
      {/* Brand mark + avatar */}
      <m.div
        className="mb-10 flex flex-col items-center gap-4"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={springs.gentle}
      >
        <div className="flex items-center gap-2.5">
          <svg
            width="32"
            height="32"
            viewBox="0 0 512 512"
            fill="currentColor"
            className="shrink-0 text-brand drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]"
            aria-hidden="true"
          >
            <g transform="translate(0,512) scale(0.1,-0.1)">
              <path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z" />
            </g>
          </svg>
          <span className="text-3xl font-display text-text-primary tracking-tight">Swapify</span>
        </div>
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-16 h-16 rounded-full shadow-lg" />
        ) : (
          <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold text-text-secondary">
            {displayName[0]}
          </div>
        )}
        <p className="text-sm text-text-secondary">Hey {firstName}, one last step.</p>
      </m.div>

      {/* Glass card */}
      <m.div
        className="glass rounded-2xl p-6 sm:p-8 w-full max-w-md"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.1 }}
      >
        {view === 'enter-email' ? (
          <m.div
            key="enter-email"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-brand/15 flex items-center justify-center">
                <Mail className="w-7 h-7 text-brand" />
              </div>
            </div>

            {/* Title & subtitle */}
            <h1 className="text-xl font-bold text-text-primary text-center mb-2">
              Verify your email
            </h1>
            <p className="text-sm text-text-secondary text-center mb-6">
              We need your email to keep you in the loop about your Swaplists.
            </p>

            {/* Email form */}
            <form onSubmit={handleSubmitEmail} className="space-y-4">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="your@email.com"
                className="input-glass w-full"
                required
                autoFocus
                autoComplete="email"
                enterKeyHint="send"
              />

              {error && <p className="text-sm text-danger text-center">{error}</p>}

              <button
                type="submit"
                disabled={isLoading || !email.trim()}
                className="btn-pill btn-pill-primary w-full disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Send verification link'}
              </button>
            </form>
          </m.div>
        ) : (
          <m.div
            key="pending"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {/* Icon */}
            <div className="flex justify-center mb-5">
              <div className="w-14 h-14 rounded-full bg-brand/15 flex items-center justify-center">
                <CheckCircle className="w-7 h-7 text-brand" />
              </div>
            </div>

            {/* Title & subtitle */}
            <h1 className="text-xl font-bold text-text-primary text-center mb-2">
              Check your inbox
            </h1>
            <p className="text-sm text-text-secondary text-center mb-6">
              We sent a verification link to{' '}
              <span className="font-medium text-text-primary">{submittedEmail}</span>
            </p>

            {/* Actions */}
            <div className="space-y-3">
              <button
                onClick={handleResend}
                disabled={isLoading}
                className="btn-pill btn-pill-secondary w-full disabled:opacity-50"
              >
                {isLoading ? 'Sending...' : 'Resend email'}
              </button>

              <button
                onClick={handleUseDifferentEmail}
                disabled={isLoading}
                className="flex items-center justify-center gap-1.5 w-full text-sm text-text-secondary hover:text-text-primary transition-colors py-2"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Use a different email
              </button>
            </div>
          </m.div>
        )}
      </m.div>

      {/* Log out link */}
      <m.div
        className="mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      >
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex items-center gap-1.5 text-text-tertiary text-sm hover:text-text-secondary transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log out
          </button>
        </form>
      </m.div>
    </div>
  );
}
