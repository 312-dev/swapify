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
  const showError = touched && clientId.length > 0 && !isClientIdValid;

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
            className="text-xs text-text-tertiary hover:text-text-secondary transition-colors inline-flex items-center gap-1"
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
          <ul className="mt-2 flex flex-col gap-1.5 list-disc list-outside ml-4 text-text-tertiary">
            <li>
              <span className="text-text-secondary">App name:</span>{' '}
              <span className="text-text-primary font-medium">Swapify</span>{' '}
              <span className="text-text-tertiary">(or anything you&apos;d like)</span>
            </li>
            <li>
              <span className="text-text-secondary">Description:</span>{' '}
              <span className="italic">A shared music inbox for you and your friends</span>
            </li>
            <li>
              <span className="text-text-secondary">Website:</span>{' '}
              <code className="text-xs bg-white/5 px-1.5 py-0.5 rounded">
                https://swapify.312.dev
              </code>
            </li>
            <li>
              <span className="text-text-secondary">Redirect URI</span>{' '}
              <span className="text-brand font-semibold">(must be exact)</span>:
              {/* Copyable redirect URI box */}
              <div className="mt-2 glass rounded-lg flex items-center gap-2 px-3 py-2.5">
                <code className="text-xs text-text-primary flex-1 break-all select-all">
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
  isValid,
  onBack,
  onConnect,
}: {
  clientId: string;
  onClientIdChange: (value: string) => void;
  showError: boolean;
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
          spellCheck={false}
          autoComplete="off"
          autoCapitalize="off"
          className={`input-glass w-full font-mono text-sm tracking-wide ${
            showError ? 'ring-2 ring-red-500/60' : ''
          }`}
        />
        {showError && (
          <m.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={springs.snappy}
            className="text-xs text-red-400"
          >
            Client ID must be a 32-character hex string.
          </m.p>
        )}
      </div>

      <p className="text-xs text-text-tertiary">
        You&apos;ll be asked to authorize Swapify to access your Spotify account.
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
          className="btn-pill flex-1 bg-[#1DB954] hover:bg-[#1ed760] text-black font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Connect with Spotify
        </button>
      </div>
    </div>
  );
}
