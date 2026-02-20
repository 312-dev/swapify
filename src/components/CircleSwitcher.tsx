'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { m, AnimatePresence } from 'motion/react';
import {
  ChevronDown,
  Check,
  Plus,
  Crown,
  Users,
  Settings,
  UserPlus,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import GlassDrawer from '@/components/ui/glass-drawer';
import SpotifySetupWizard from '@/components/SpotifySetupWizard';
import { springs, STAGGER_DELAY } from '@/lib/motion';

interface CircleMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface Circle {
  id: string;
  name: string;
  imageUrl?: string | null;
  spotifyClientId: string;
  inviteCode: string;
  maxMembers: number;
  role: string; // 'host' | 'member'
  memberCount: number;
  members: CircleMember[];
}

interface CirclePreview {
  id: string;
  name: string;
  hostName: string;
  memberCount: number;
  spotifyClientId: string;
}

interface CircleSwitcherProps {
  circles: Circle[];
  activeCircleId: string | null;
  activeCircleName: string | null;
}

export default function CircleSwitcher({
  circles,
  activeCircleId,
  activeCircleName,
}: CircleSwitcherProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState<string | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Join circle state
  const [showJoinForm, setShowJoinForm] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinPreview, setJoinPreview] = useState<CirclePreview | null>(null);
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const userHostsCircle = circles.some((c) => c.role === 'host');

  async function handleSwitch(circleId: string) {
    if (circleId === activeCircleId) {
      setIsOpen(false);
      return;
    }

    setIsSwitching(circleId);

    try {
      const res = await fetch('/api/circles/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to switch circle');
      }

      setIsOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to switch circle');
    } finally {
      setIsSwitching(null);
    }
  }

  function handleCreateCircle() {
    setIsOpen(false);
    setTimeout(() => setShowSetupWizard(true), 200);
  }

  function resetJoinState() {
    setShowJoinForm(false);
    setJoinCode('');
    setJoinPreview(null);
    setIsLookingUp(false);
    setIsJoining(false);
    setJoinError(null);
  }

  async function lookupCircleCode(code: string) {
    setIsLookingUp(true);
    setJoinError(null);
    setJoinPreview(null);

    try {
      const res = await fetch(`/api/circles/resolve?code=${encodeURIComponent(code)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite code');
      }
      const circle: CirclePreview = await res.json();
      setJoinPreview(circle);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setIsLookingUp(false);
    }
  }

  function handleJoinCircle() {
    if (!joinPreview) return;
    setIsJoining(true);

    // Joining requires OAuth with the circle's Spotify client ID
    const loginUrl =
      `/api/auth/login?clientId=${encodeURIComponent(joinPreview.spotifyClientId)}` +
      `&circleAction=join` +
      `&circleId=${encodeURIComponent(joinPreview.id)}` +
      `&returnTo=${encodeURIComponent('/dashboard')}`;

    window.location.href = loginUrl;
  }

  return (
    <>
      {/* Centered trigger — Life360-style pill */}
      <button
        onClick={() => setIsOpen(true)}
        className="mx-auto flex items-center gap-1.5 px-4 py-1.5 rounded-full glass active:scale-[0.97] transition-transform"
        aria-label="Switch circle"
      >
        <Users className="w-3.5 h-3.5 text-brand shrink-0" />
        <span className="text-sm font-semibold text-text-primary truncate max-w-45">
          {activeCircleName ?? 'Select circle'}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-text-tertiary shrink-0" />
      </button>

      {/* Circle list drawer */}
      <GlassDrawer
        isOpen={isOpen}
        onClose={() => {
          setIsOpen(false);
          resetJoinState();
        }}
        title="Your Circles"
        snapPoint="half"
      >
        <div className="flex flex-col gap-2">
          {circles.map((circle, index) => {
            const isActive = circle.id === activeCircleId;
            const isLoading = isSwitching === circle.id;
            const isHost = circle.role === 'host';

            return (
              <m.div
                key={circle.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: STAGGER_DELAY * index }}
                className={`w-full glass rounded-xl p-4 flex items-center gap-3 ${
                  isActive ? 'ring-1 ring-brand/40 glow-brand' : ''
                }`}
              >
                <button
                  onClick={() => handleSwitch(circle.id)}
                  disabled={isLoading}
                  className="flex items-center gap-3 flex-1 min-w-0 text-left active:scale-[0.98] transition-transform"
                >
                  {/* Circle icon / image */}
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 overflow-hidden ${
                      isActive ? 'bg-brand/15 text-brand' : 'bg-white/5 text-text-tertiary'
                    }`}
                  >
                    {circle.imageUrl ? (
                      <img src={circle.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-5 h-5" />
                    )}
                  </div>

                  {/* Circle info */}
                  <div className="flex-1 min-w-0">
                    <p className="text-[15px] font-semibold text-text-primary truncate">
                      {circle.name}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      {isHost ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-brand shrink-0">
                          <Crown className="w-3 h-3" />
                          Host
                        </span>
                      ) : (
                        <span className="text-xs text-text-secondary shrink-0">Member</span>
                      )}

                      {/* Member avatars */}
                      {circle.members.length > 0 && (
                        <div className="flex items-center -space-x-1.5 ml-1">
                          {circle.members.slice(0, 5).map((member) => (
                            <div
                              key={member.id}
                              title={member.displayName}
                              className="w-5 h-5 rounded-full ring-1 ring-card shrink-0 overflow-hidden"
                            >
                              {member.avatarUrl ? (
                                <img
                                  src={member.avatarUrl}
                                  alt={member.displayName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-white/10 flex items-center justify-center text-[9px] font-medium text-text-secondary">
                                  {member.displayName[0]}
                                </div>
                              )}
                            </div>
                          ))}
                          {circle.members.length > 5 && (
                            <div
                              title={circle.members
                                .slice(5)
                                .map((m) => m.displayName)
                                .join(', ')}
                              className="w-5 h-5 rounded-full ring-1 ring-card shrink-0 bg-white/10 flex items-center justify-center text-[9px] font-medium text-text-tertiary"
                            >
                              +{circle.members.length - 5}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Active checkmark or loading spinner */}
                  <div className="shrink-0 w-5 h-5 flex items-center justify-center">
                    {isLoading ? (
                      <svg
                        className="w-4 h-4 animate-spin text-brand"
                        viewBox="0 0 24 24"
                        fill="none"
                      >
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
                    ) : isActive ? (
                      <Check className="w-5 h-5 text-brand" />
                    ) : null}
                  </div>
                </button>

                {/* Settings button — navigates to settings page */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsOpen(false);
                    router.push(`/circle/${circle.id}/settings`);
                  }}
                  className="shrink-0 p-2 -mr-1 rounded-lg hover:bg-white/10 transition-colors"
                  aria-label={isHost ? 'Edit circle' : 'Circle settings'}
                >
                  <Settings className="w-4 h-4 text-text-tertiary" />
                </button>
              </m.div>
            );
          })}

          {/* Divider */}
          <div className="flex items-center gap-3 my-1">
            <div className="flex-1 h-px bg-white/10" />
          </div>

          {/* Join a Circle — inline expandable section */}
          <m.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: STAGGER_DELAY * circles.length }}
          >
            <AnimatePresence mode="wait">
              {!showJoinForm ? (
                <m.button
                  key="join-collapsed"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={springs.snappy}
                  onClick={() => setShowJoinForm(true)}
                  className="w-full glass rounded-xl p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
                >
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                    <UserPlus className="w-5 h-5 text-brand" />
                  </div>
                  <span className="text-[15px] font-semibold text-text-primary">Join a Circle</span>
                </m.button>
              ) : (
                <m.div
                  key="join-expanded"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={springs.snappy}
                  className="glass rounded-xl p-4 overflow-hidden"
                >
                  {/* Header row */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center shrink-0">
                      <UserPlus className="w-5 h-5 text-brand" />
                    </div>
                    <span className="text-[15px] font-semibold text-text-primary flex-1">
                      Join a Circle
                    </span>
                  </div>

                  <AnimatePresence mode="wait">
                    {!joinPreview ? (
                      <m.div
                        key="join-input"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={springs.snappy}
                        className="space-y-3"
                      >
                        <div>
                          <label
                            htmlFor="circle-join-code"
                            className="block text-sm font-medium text-text-secondary mb-1.5"
                          >
                            Invite code
                          </label>
                          <div className="flex gap-2">
                            <input
                              id="circle-join-code"
                              type="text"
                              value={joinCode}
                              onChange={(e) => {
                                setJoinCode(e.target.value);
                                if (joinError) setJoinError(null);
                              }}
                              placeholder="Enter invite code"
                              className="input-glass flex-1"
                            />
                            <button
                              onClick={() => lookupCircleCode(joinCode.trim())}
                              disabled={!joinCode.trim() || isLookingUp}
                              className="btn-pill btn-pill-primary disabled:opacity-50"
                            >
                              {isLookingUp ? 'Looking...' : 'Find'}
                            </button>
                          </div>
                        </div>

                        {joinError && (
                          <m.div
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={springs.snappy}
                            className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger flex items-start gap-2"
                          >
                            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                            <span>{joinError}</span>
                          </m.div>
                        )}

                        <button
                          onClick={resetJoinState}
                          className="text-sm text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Back
                        </button>
                      </m.div>
                    ) : (
                      <m.div
                        key="join-preview"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={springs.snappy}
                        className="space-y-3"
                      >
                        <div className="glass rounded-xl p-5 text-center">
                          {/* Circle icon */}
                          <div className="w-14 h-14 rounded-full bg-brand/15 flex items-center justify-center mx-auto mb-3">
                            <Users className="w-7 h-7 text-brand" />
                          </div>

                          <h3 className="text-lg font-semibold text-text-primary mb-1">
                            {joinPreview.name}
                          </h3>

                          <div className="flex items-center justify-center gap-2 text-sm text-text-secondary mb-4">
                            <span className="inline-flex items-center gap-1">
                              <Crown className="w-3.5 h-3.5 text-brand" />
                              {joinPreview.hostName}
                            </span>
                            <span>&middot;</span>
                            <span>
                              {joinPreview.memberCount} member
                              {joinPreview.memberCount !== 1 ? 's' : ''}
                            </span>
                          </div>

                          <button
                            onClick={handleJoinCircle}
                            disabled={isJoining}
                            className="btn-pill w-full bg-accent-green hover:bg-accent-green/90 text-black font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            {isJoining ? (
                              <>
                                <svg
                                  className="w-4 h-4 animate-spin"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                >
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

                          <p className="text-xs text-text-tertiary mt-3 leading-relaxed">
                            The host may need to add your Spotify email to their developer app
                            first.
                          </p>
                        </div>

                        <button
                          onClick={() => {
                            setJoinPreview(null);
                            setJoinCode('');
                            setJoinError(null);
                          }}
                          className="text-sm text-text-secondary hover:text-text-primary transition-colors inline-flex items-center gap-1.5"
                        >
                          <ArrowLeft className="w-4 h-4" />
                          Use a different code
                        </button>
                      </m.div>
                    )}
                  </AnimatePresence>
                </m.div>
              )}
            </AnimatePresence>
          </m.div>

          {/* Create a Circle — disabled if user already hosts one */}
          <m.button
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: STAGGER_DELAY * (circles.length + 1) }}
            onClick={handleCreateCircle}
            disabled={userHostsCircle}
            className={`w-full glass rounded-xl p-4 flex items-center gap-3 text-left transition-transform ${
              userHostsCircle ? 'opacity-40 cursor-not-allowed' : 'active:scale-[0.98]'
            }`}
          >
            <div
              className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                userHostsCircle ? 'bg-white/5' : 'bg-brand/10'
              }`}
            >
              <Plus
                className={`w-5 h-5 ${userHostsCircle ? 'text-text-tertiary' : 'text-brand'}`}
              />
            </div>
            <div className="flex-1 min-w-0">
              <span
                className={`text-[15px] font-semibold ${userHostsCircle ? 'text-text-tertiary' : 'text-brand'}`}
              >
                Create a Circle
              </span>
              {userHostsCircle && (
                <p className="text-xs text-text-tertiary mt-0.5">You can only create one circle</p>
              )}
            </div>
          </m.button>
        </div>
      </GlassDrawer>

      {/* Spotify Setup Wizard for creating a new circle */}
      <SpotifySetupWizard isOpen={showSetupWizard} onClose={() => setShowSetupWizard(false)} />
    </>
  );
}
