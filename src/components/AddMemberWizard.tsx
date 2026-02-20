'use client';

import { useState } from 'react';
import { m, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Copy,
  Mail,
  ExternalLink,
  AlertCircle,
  Link2,
} from 'lucide-react';
import { toast } from 'sonner';
import GlassDrawer from '@/components/ui/glass-drawer';
import { springs, STAGGER_DELAY } from '@/lib/motion';

interface AddMemberWizardProps {
  isOpen: boolean;
  onClose: () => void;
  circleId: string;
  spotifyClientId: string;
  inviteCode: string;
}

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

export default function AddMemberWizard({
  isOpen,
  onClose,
  circleId,
  spotifyClientId,
  inviteCode,
}: AddMemberWizardProps) {
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [copied, setCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [email, setEmail] = useState('');
  const [isSending, setIsSending] = useState(false);

  function handleClose() {
    onClose();
    setTimeout(() => {
      setStep(0);
      setDirection(1);
      setCopied(false);
      setEmail('');
      setIsSending(false);
    }, 300);
  }

  function handleCopy() {
    navigator.clipboard.writeText(inviteCode).then(() => {
      setCopied(true);
      toast.success('Invite code copied');
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleCopyShareLink() {
    const link = `${window.location.origin}/circle/join?code=${inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      toast.success('Share link copied');
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  async function handleSendEmail() {
    if (!email.trim()) return;
    setIsSending(true);
    try {
      const res = await fetch(`/api/circles/${circleId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to send invite');
      }
      toast.success(`Invite sent to ${email.trim()}`);
      setEmail('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invite');
    } finally {
      setIsSending(false);
    }
  }

  return (
    <GlassDrawer isOpen={isOpen} onClose={handleClose} title="Add a Member">
      {/* Step dots */}
      <div className="flex items-center justify-center gap-2 mb-5">
        {[0, 1].map((i) => (
          <div
            key={i}
            className={`h-2 rounded-full transition-all duration-300 ${
              i === step ? 'w-6 bg-brand' : 'w-2 bg-white/20'
            }`}
          />
        ))}
      </div>

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
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-text-primary">
                  Step 1: Add their Spotify email
                </h3>

                <ol className="list-decimal list-outside ml-5 flex flex-col gap-3 text-sm text-text-secondary">
                  <m.li
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.gentle, delay: STAGGER_DELAY }}
                  >
                    Go to your{' '}
                    <a
                      href={`https://developer.spotify.com/dashboard/${spotifyClientId}/users`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-brand hover:underline inline-flex items-center gap-1"
                    >
                      Spotify Developer Dashboard
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </m.li>

                  <m.li
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.gentle, delay: STAGGER_DELAY * 2 }}
                  >
                    Click{' '}
                    <span className="font-semibold text-text-primary">
                      &quot;Add new user&quot;
                    </span>
                  </m.li>

                  <m.li
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.gentle, delay: STAGGER_DELAY * 3 }}
                  >
                    Enter their <span className="font-semibold text-text-primary">name</span> and{' '}
                    <span className="font-semibold text-text-primary">Spotify email address</span>
                  </m.li>

                  <m.li
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ ...springs.gentle, delay: STAGGER_DELAY * 4 }}
                  >
                    Click{' '}
                    <span className="font-semibold text-text-primary">&quot;Add user&quot;</span>
                  </m.li>
                </ol>

                {/* Info callout */}
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-sm text-amber-200 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <span>This step is required by Spotify before they can join your circle.</span>
                </div>

                {/* Navigation */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn-pill btn-pill-secondary flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(1);
                      setStep(1);
                    }}
                    className="btn-pill btn-pill-primary flex-1 flex items-center justify-center gap-2"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
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
              <div className="flex flex-col gap-4">
                <h3 className="text-lg font-bold text-text-primary">
                  Step 2: Share your invite code
                </h3>

                <p className="text-sm text-text-secondary">
                  Send this code to your friend so they can join your circle in Swapify.
                </p>

                {/* Invite code display */}
                <div className="glass rounded-xl p-5 text-center">
                  <code className="text-2xl font-mono font-bold text-text-primary tracking-[0.2em] select-all">
                    {inviteCode}
                  </code>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="mt-3 mx-auto btn-pill btn-pill-secondary flex items-center gap-2 text-sm"
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 text-green-400" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        Copy Code
                      </>
                    )}
                  </button>
                  <div className="mt-3 pt-3 border-t border-white/5">
                    <button
                      type="button"
                      onClick={handleCopyShareLink}
                      className="mx-auto btn-pill btn-pill-secondary flex items-center gap-2 text-sm"
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-4 h-4 text-green-400" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Link2 className="w-4 h-4" />
                          Copy Share Link
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Or send by email */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                    Or send by email
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="friend@example.com"
                      className="input-glass flex-1"
                    />
                    <button
                      type="button"
                      onClick={handleSendEmail}
                      disabled={!email.trim() || isSending}
                      className="btn-pill btn-pill-primary flex items-center gap-1.5 disabled:opacity-50"
                    >
                      <Mail className="w-4 h-4" />
                      {isSending ? 'Sending...' : 'Send'}
                    </button>
                  </div>
                </div>

                {/* Navigation */}
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection(-1);
                      setStep(0);
                    }}
                    className="btn-pill btn-pill-secondary flex items-center gap-1.5"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="btn-pill btn-pill-primary flex-1"
                  >
                    Done
                  </button>
                </div>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </GlassDrawer>
  );
}
