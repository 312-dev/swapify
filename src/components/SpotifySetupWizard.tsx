'use client';

import { useState, useMemo } from 'react';
import { m, AnimatePresence } from 'motion/react';
import { ExternalLink, Copy, Check, ChevronRight, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import GlassDrawer from '@/components/ui/glass-drawer';
import { springs, STAGGER_DELAY } from '@/lib/motion';

interface SpotifySetupWizardProps {
  isOpen: boolean;
  onClose: () => void;
}

const CLIENT_ID_REGEX = /^[a-f0-9]{32}$/;

/** Returns a specific error message if the input looks wrong, or null if valid. */
function getClientIdError(raw: string): string | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  // Valid client ID
  if (CLIENT_ID_REGEX.test(trimmed.toLowerCase())) return null;

  // Too long — they may have pasted both Client ID and Client Secret
  if (trimmed.length > 32) {
    // Check if it contains a valid 32-char hex prefix (ID followed by secret)
    if (/^[a-f0-9]{32}/i.test(trimmed)) {
      return 'This looks like more than just the Client ID. Make sure you only paste the Client ID (32 characters), not the Client Secret.';
    }
    return `Too long (${trimmed.length} chars). The Client ID is exactly 32 characters — make sure you didn\u2019t paste the Client Secret by mistake.`;
  }

  // Too short
  if (trimmed.length < 32) {
    return `Too short (${trimmed.length}/32 characters). The Client ID is exactly 32 characters.`;
  }

  // Right length but wrong characters (uppercase, special chars, etc.)
  if (trimmed.length === 32 && /[^a-f0-9]/i.test(trimmed)) {
    if (/[A-Z]/.test(trimmed) && !/[^a-fA-F0-9]/.test(trimmed)) {
      // All hex chars but has uppercase — auto-fix will handle this, it's fine
      return null;
    }
    return 'The Client ID should only contain letters a\u2013f and numbers 0\u20139. Make sure you copied the Client ID, not the Client Secret.';
  }

  return 'Client ID must be a 32-character hex string.';
}

export default function SpotifySetupWizard({ isOpen, onClose }: SpotifySetupWizardProps) {
  const [step, setStep] = useState(0);
  const [clientId, setClientId] = useState('');
  const [copied, setCopied] = useState(false);
  const [touched, setTouched] = useState(false);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back

  const redirectUri = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return window.location.origin + '/api/auth/callback';
  }, []);

  const isClientIdValid = CLIENT_ID_REGEX.test(clientId.trim().toLowerCase());
  const clientIdError = touched ? getClientIdError(clientId) : null;
  const showError = clientIdError !== null;

  function handleCopyRedirectUri() {
    navigator.clipboard.writeText(redirectUri).then(() => {
      setCopied(true);
      toast.success('Redirect URI copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleNext() {
    setDirection(1);
    setStep(1);
  }

  function handleBack() {
    setDirection(-1);
    setStep(0);
  }

  function handleConnect() {
    const trimmed = clientId.trim().toLowerCase();
    if (!CLIENT_ID_REGEX.test(trimmed)) {
      toast.error('Please enter a valid 32-character Client ID');
      return;
    }
    window.location.href = `/api/auth/login?clientId=${encodeURIComponent(trimmed)}`;
  }

  function handleClose() {
    onClose();
    // Reset state after drawer animation completes
    setTimeout(() => {
      setStep(0);
      setClientId('');
      setTouched(false);
      setCopied(false);
      setDirection(1);
    }, 300);
  }

  const slideVariants = {
    enter: (dir: number) => ({
      x: dir > 0 ? 80 : -80,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (dir: number) => ({
      x: dir > 0 ? -80 : 80,
      opacity: 0,
    }),
  };

  return (
    <GlassDrawer isOpen={isOpen} onClose={handleClose} snapPoint="full">
      <div className="flex flex-col gap-5 min-h-0">
        {/* Step indicator dots */}
        <div className="flex items-center justify-center gap-2">
          {[0, 1].map((i) => (
            <div
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${
                i === step ? 'w-6 bg-brand' : 'w-2 bg-white/20'
              }`}
            />
          ))}
        </div>

        {/* Step content */}
        <div className="relative overflow-hidden">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 0 && (
              <m.div
                key="step-1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springs.smooth}
              >
                <StepOne
                  redirectUri={redirectUri}
                  copied={copied}
                  onCopy={handleCopyRedirectUri}
                  onNext={handleNext}
                />
              </m.div>
            )}

            {step === 1 && (
              <m.div
                key="step-2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={springs.smooth}
              >
                <StepTwo
                  clientId={clientId}
                  onClientIdChange={(v) => {
                    setClientId(v);
                    if (!touched) setTouched(true);
                  }}
                  showError={showError}
                  errorMessage={clientIdError}
                  isValid={isClientIdValid}
                  onBack={handleBack}
                  onConnect={handleConnect}
                />
              </m.div>
            )}
          </AnimatePresence>
        </div>

        {/* Help link */}
        <div className="text-center pt-2 pb-1">
          <a
            href="https://developer.spotify.com/documentation/web-api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-text-tertiary hover:text-text-secondary transition-colors inline-flex items-center gap-1"
          >
            Need help?
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </GlassDrawer>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 1 — Create a Spotify App                                             */
/* -------------------------------------------------------------------------- */

function StepOne({
  redirectUri,
  copied,
  onCopy,
  onNext,
}: {
  redirectUri: string;
  copied: boolean;
  onCopy: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold text-text-primary">Step 1: Create a Spotify App</h2>

      <ol className="list-decimal list-outside ml-5 flex flex-col gap-3 text-sm text-text-secondary">
        <m.li
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 1 }}
        >
          Go to{' '}
          <a
            href="https://developer.spotify.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand hover:underline inline-flex items-center gap-1"
          >
            developer.spotify.com/dashboard
            <ExternalLink className="w-3 h-3" />
          </a>
        </m.li>

        <m.li
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 2 }}
        >
          Click <span className="font-semibold text-text-primary">&quot;Create App&quot;</span>
        </m.li>

        <m.li
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 3 }}
        >
          <span>Fill in the following details:</span>
          <ul className="mt-2 flex flex-col gap-1.5 list-disc list-outside ml-4 text-text-secondary">
            <li>
              <span className="text-text-secondary">App name:</span>{' '}
              <span className="text-text-primary font-medium">Swapify</span>{' '}
              <span className="text-text-tertiary">(or anything you&apos;d like)</span>
            </li>
            <li>
              <span className="text-text-secondary">Description:</span>{' '}
              <span className="italic">A shared playlist that clears as you listen</span>
            </li>
            <li>
              <span className="text-text-secondary">Website:</span>{' '}
              <code className="text-sm bg-white/5 px-1.5 py-0.5 rounded">
                https://swapify.312.dev
              </code>
            </li>
            <li>
              <span className="text-text-secondary">Redirect URI</span>{' '}
              <span className="text-brand font-semibold">(must be exact)</span>:
              {/* Copyable redirect URI box */}
              <div className="mt-2 glass rounded-lg flex items-center gap-2 px-3 py-2.5">
                <code className="text-sm text-text-primary flex-1 break-all select-all">
                  {redirectUri}
                </code>
                <button
                  type="button"
                  onClick={onCopy}
                  className="shrink-0 p-1.5 rounded-md hover:bg-white/10 transition-colors"
                  aria-label="Copy redirect URI"
                >
                  {copied ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-text-tertiary" />
                  )}
                </button>
              </div>
            </li>
            <li>
              Check <span className="font-semibold text-text-primary">&quot;Web API&quot;</span>
            </li>
          </ul>
        </m.li>

        <m.li
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 4 }}
        >
          Click <span className="font-semibold text-text-primary">&quot;Save&quot;</span>
        </m.li>
      </ol>

      <m.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: STAGGER_DELAY * 5 }}
        className="pt-2"
      >
        <button
          type="button"
          onClick={onNext}
          className="btn-pill btn-pill-primary w-full flex items-center justify-center gap-2"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </m.div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Step 2 — Enter Your Client ID                                             */
/* -------------------------------------------------------------------------- */

function StepTwo({
  clientId,
  onClientIdChange,
  showError,
  errorMessage,
  isValid,
  onBack,
  onConnect,
}: {
  clientId: string;
  onClientIdChange: (value: string) => void;
  showError: boolean;
  errorMessage: string | null;
  isValid: boolean;
  onBack: () => void;
  onConnect: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-xl font-bold text-text-primary">Step 2: Enter Your Client ID</h2>

      <p className="text-sm text-text-secondary">
        Go to your new app&apos;s <span className="font-semibold text-text-primary">Settings</span>{' '}
        page and copy the <span className="font-semibold text-text-primary">Client ID</span>.
      </p>

      <div className="flex flex-col gap-1.5">
        <input
          type="text"
          value={clientId}
          onChange={(e) => onClientIdChange(e.target.value)}
          placeholder="e.g. a1b2c3d4e5f6..."
          maxLength={128}
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className={`input-glass w-full font-mono text-sm tracking-wide ${
            showError ? 'ring-2 ring-red-500/60' : ''
          }`}
        />
        {showError && errorMessage && (
          <m.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.snappy}
            className="text-xs text-red-400"
          >
            {errorMessage}
          </m.p>
        )}
      </div>

      <p className="text-xs text-text-tertiary">
        Paste only the <span className="text-text-secondary font-medium">Client ID</span> — never
        the Client Secret. Your Client ID is safe to share and is not stored on our servers.
      </p>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="btn-pill btn-pill-secondary flex items-center gap-1.5"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <button
          type="button"
          onClick={onConnect}
          disabled={!isValid}
          className="btn-pill flex-1 bg-accent-green hover:bg-accent-green/90 text-black font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
          </svg>
          Connect with Spotify
        </button>
      </div>
    </div>
  );
}
