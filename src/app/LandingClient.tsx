'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  m,
  useInView,
  AnimatePresence,
  useReducedMotion,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'motion/react';
import {
  CirclePlus,
  Crown,
  Github,
  Globe,
  Headphones,
  Heart,
  Mail,
  Music,
  Pizza,
  Play,
  Plus,
  Settings,
  Shield,
  Share2,
  UserPlus,
} from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { springs, fade } from '@/lib/motion';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import SpotifySetupWizard from '@/components/SpotifySetupWizard';

/* ------------------------------------------------------------------ */
/*  Crossfading hero video background                                  */
/* ------------------------------------------------------------------ */

const ALL_HERO_VIDEOS = [
  '/videos/hero-1.mp4',
  '/videos/hero-2.mp4',
  '/videos/hero-3.mp4',
  '/videos/hero-4.mp4',
  '/videos/hero-5.mp4',
  '/videos/hero-6.mp4',
  '/videos/hero-7.mp4',
  '/videos/hero-8.mp4',
  '/videos/hero-9.mp4',
  '/videos/hero-10.mp4',
  '/videos/hero-11.mp4',
];

/** Pick `count` random items from `arr` (Fisher-Yates partial shuffle). */
function pickRandom<T>(arr: T[], count: number): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy.slice(0, count);
}

const FADE_MS = 1200;
const CLIP_DURATION_MS = 5000;
const VIDEO_OPACITY = 0.55;

/** Load a video, seek to a random point with at least `minRemaining` seconds left, and play. */
function loadAtRandomTime(video: HTMLVideoElement, src: string, minRemaining: number) {
  video.src = src;
  video.load();

  const onReady = () => {
    video.removeEventListener('loadedmetadata', onReady);
    const maxStart = Math.max(0, video.duration - minRemaining);
    if (maxStart > 0) {
      video.currentTime = Math.random() * maxStart;
    }
    video.play().catch(() => {});
  };

  video.addEventListener('loadedmetadata', onReady);
}

/**
 * Two overlapping <video> elements that true-crossfade into each other.
 * On mount, picks 3 random clips and cycles through them.
 * Each clip starts at a random position (with at least 5s remaining).
 */
function HeroVideoBackground() {
  const clips = useMemo(() => pickRandom(ALL_HERO_VIDEOS, 3), []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [frontLayer, setFrontLayer] = useState<0 | 1>(0);
  const ref0 = useRef<HTMLVideoElement>(null);
  const ref1 = useRef<HTMLVideoElement>(null);
  const videoRefs = useMemo(() => [ref0, ref1] as const, []);

  // Initial load: front layer gets clip 0
  useEffect(() => {
    const v = videoRefs[0].current;
    if (v && clips[0]) loadAtRandomTime(v, clips[0], CLIP_DURATION_MS / 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cycle: every CLIP_DURATION_MS, preload next clip on back layer, then swap
  useEffect(() => {
    const id = setTimeout(() => {
      const nextIdx = (currentIdx + 1) % clips.length;
      const backLayer: 0 | 1 = frontLayer === 0 ? 1 : 0;

      const v = videoRefs[backLayer].current;
      const nextClip = clips[nextIdx];
      if (v && nextClip) loadAtRandomTime(v, nextClip, CLIP_DURATION_MS / 1000);

      setFrontLayer(backLayer);
      setCurrentIdx(nextIdx);
    }, CLIP_DURATION_MS);

    return () => clearTimeout(id);
  }, [currentIdx, frontLayer, clips, videoRefs]);

  const layerClass =
    'absolute inset-0 w-full h-full object-cover transition-opacity ease-in-out motion-reduce:hidden';

  return (
    <>
      <video
        ref={ref0}
        muted
        playsInline
        className={layerClass}
        style={{
          opacity: frontLayer === 0 ? VIDEO_OPACITY : 0,
          transitionDuration: `${FADE_MS}ms`,
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
      <video
        ref={ref1}
        muted
        playsInline
        className={layerClass}
        style={{
          opacity: frontLayer === 1 ? VIDEO_OPACITY : 0,
          transitionDuration: `${FADE_MS}ms`,
        }}
        aria-hidden="true"
        tabIndex={-1}
      />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated phone mockup — looping story demo                         */
/* ------------------------------------------------------------------ */

type MockupPhase = 'resting' | 'song-added' | 'listening' | 'reaction' | 'archive' | 'reset';

/* Walkthrough steps — user-facing narration synced to phone phases */
const WALKTHROUGH_STEPS = [
  {
    id: 'song-added' as const,
    phase: 'song-added' as MockupPhase,
    subtitle:
      'Friends drop songs into a shared inbox — your group\u2019s next favorite is already waiting.',
    duration: 8200,
  },
  {
    id: 'listening' as const,
    phase: 'listening' as MockupPhase,
    subtitle:
      'Just listen on Spotify like you normally do — once everyone\u2019s heard it, the track archives itself.',
    duration: 8400,
  },
  {
    id: 'reaction' as const,
    phase: 'reaction' as MockupPhase,
    subtitle: 'Swipe, tap, react — let the group know which tracks hit and which ones missed.',
    duration: 8200,
  },
  {
    id: 'archive' as const,
    phase: 'archive' as MockupPhase,
    subtitle: 'Played it? It rotates out automatically\u2009—\u2009your playlist never gets stale.',
    duration: 7200,
  },
] as const;

const TRANSITION_MS = 500; // brief resting gap between steps
const IDLE_RESUME_MS = 8000; // resume auto-play after manual nav idle

const MOCKUP_TRACKS = [
  {
    id: 'levitating',
    title: 'Levitating',
    artist: 'Dua Lipa',
    time: '2h',
    src: '/images/mockup/future-nostalgia.jpg',
    addedBy: '/images/mockup/member-1.jpg',
  },
  {
    id: 'blinding',
    title: 'Blinding Lights',
    artist: 'The Weeknd',
    time: '1h',
    src: '/images/mockup/after-hours.jpg',
    addedBy: '/images/mockup/member-2.jpg',
  },
  {
    id: 'espresso',
    title: 'Espresso',
    artist: 'Sabrina Carpenter',
    time: '30m',
    src: '/images/mockup/espresso.jpg',
    addedBy: '/images/mockup/member-3.jpg',
  },
] as const;

const NOTIFICATION_CONFIGS: {
  id: string;
  phase: MockupPhase;
  delay: number;
  hold?: number;
  avatar: string;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'added',
    phase: 'song-added' as MockupPhase,
    delay: 400,
    hold: 7000,
    avatar: '/images/mockup/member-1.jpg',
    title: 'Sarah added a track',
    subtitle: 'Espresso \u00B7 just now',
  },
  {
    id: 'reacted',
    phase: 'reaction' as MockupPhase,
    delay: 2500, // after emoji selection at 1800ms
    avatar: '/images/mockup/member-2.jpg',
    title: 'Mike reacted \uD83D\uDD25 to your song',
    subtitle: 'Espresso \u00B7 just now',
  },
  {
    id: 'archived',
    phase: 'archive' as MockupPhase,
    delay: 800,
    avatar: '/images/mockup/member-3.jpg',
    title: 'Espresso archived',
    subtitle: 'Everyone listened \u2713',
  },
];

const RING_CIRCUMFERENCE = 2 * Math.PI * 10;

function MockupProgressRing({
  listened,
  total,
  isComplete,
}: {
  listened: number;
  total: number;
  isComplete: boolean;
}) {
  const offset = isComplete
    ? 0
    : total === 0
      ? RING_CIRCUMFERENCE
      : RING_CIRCUMFERENCE * (1 - listened / total);
  return (
    <div className="w-6 h-6 shrink-0 relative">
      <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="rgba(255,255,255,0.1)"
          strokeWidth="2.5"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke={isComplete ? '#38BDF8' : 'rgba(56,189,248,0.6)'}
          strokeWidth="2.5"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease-out' }}
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-medium ${
          isComplete ? 'text-brand font-bold text-[7px]' : 'text-white/50 text-[6px]'
        }`}
      >
        {isComplete ? '\u2713' : `${listened}/${total}`}
      </span>
    </div>
  );
}

/** iOS-style notification banner rendered inside the phone screen */
function MockupNotification({ phase }: { phase: MockupPhase }) {
  const [activeNotif, setActiveNotif] = useState<string | null>(null);

  useEffect(() => {
    if (phase === 'reset' || phase === 'resting') {
      setActiveNotif(null); // eslint-disable-line react-hooks/set-state-in-effect -- intentional sync with phase
      return;
    }

    const matching = NOTIFICATION_CONFIGS.find((n) => n.phase === phase);
    if (!matching) return;

    // Show after delay, hold longer so users can read it
    const showTimer = setTimeout(() => setActiveNotif(matching.id), matching.delay);
    const holdMs = matching.hold ?? 3500;
    const hideTimer = setTimeout(() => setActiveNotif(null), matching.delay + holdMs);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [phase]);

  const notif = NOTIFICATION_CONFIGS.find((n) => n.id === activeNotif);

  return (
    <div className="absolute top-1 left-2 right-2 z-30 pointer-events-none">
      <AnimatePresence>
        {notif && (
          <m.div
            key={notif.id}
            className="bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/[0.08] rounded-2xl px-3 py-2 flex items-center gap-2 shadow-xl shadow-black/50"
            initial={{ opacity: 0, y: -40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            transition={springs.snappy}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={notif.avatar} alt="" className="w-6 h-6 rounded-full object-cover shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-white truncate">{notif.title}</p>
              <p className="text-[8px] text-white/50 truncate">{notif.subtitle}</p>
            </div>
            <span className="text-[7px] text-white/30 shrink-0">now</span>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function PhoneMockup({
  phase,
  listenProgress,
  showOverlay,
  selectedEmoji,
  espressoVisible,
}: {
  phase: MockupPhase;
  listenProgress: number;
  showOverlay: boolean;
  selectedEmoji: string | null;
  espressoVisible: boolean;
}) {
  const coverUrl = '/images/mockup/weekend-vibes.jpg';
  const albumColors = useAlbumColors(coverUrl);

  // Live clock for status bar
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const timeStr = now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  // Derive inbox count from phase
  const inboxCount = useMemo(() => {
    switch (phase) {
      case 'resting':
      case 'reset':
        return 2;
      case 'song-added':
        return 3;
      case 'listening':
        return Math.max(1, 3 - listenProgress);
      case 'reaction':
      case 'archive':
        return 1;
    }
  }, [phase, listenProgress]);

  // Track visibility — Espresso at top so animated events are in-shot
  const visibleTracks = useMemo(() => {
    const base = MOCKUP_TRACKS.slice(0, 2);
    if (espressoVisible) return [MOCKUP_TRACKS[2], ...base];
    return base;
  }, [espressoVisible]);

  // Espresso-specific states
  const espressoListened = phase === 'archive' ? 3 : phase === 'listening' ? listenProgress : 0;
  const espressoComplete = phase === 'archive';
  const showEspressoReaction = phase === 'reaction' && !showOverlay && selectedEmoji !== null;
  const isEspressoArchiving = phase === 'archive';

  return (
    <div className="relative mx-auto w-[290px] select-none">
      {/* Frame */}
      <div className="rounded-[2.5rem] border-[3px] border-white/[0.12] bg-black p-3 shadow-2xl shadow-black/60">
        {/* Screen */}
        <div
          className="rounded-[2rem] overflow-hidden relative"
          style={{
            height: 540,
            backgroundColor: '#0a0a0a',
            backgroundImage: albumColors.isExtracted
              ? albumColors.backgroundImage
              : 'linear-gradient(to bottom, #081420, #0a0a0a)',
          }}
        >
          {/* iOS notification banner — overlays from top */}
          <MockupNotification phase={phase} />

          {/* Status bar */}
          <div className="flex justify-between items-center px-6 pt-4 pb-1 text-[10px]">
            <span className="font-semibold text-white/70" suppressHydrationWarning>
              {timeStr}
            </span>
            <div className="flex items-center gap-1 text-white/50">
              <div className="flex items-end gap-[2px]">
                {[3, 5, 7, 10].map((h) => (
                  <div key={h} className="w-[3px] rounded-sm bg-white/60" style={{ height: h }} />
                ))}
              </div>
              <div className="w-4 h-2.5 rounded-sm border border-white/50 ml-1">
                <div className="w-2.5 h-1.5 bg-white/50 rounded-sm m-px" />
              </div>
            </div>
          </div>

          {/* Playlist header */}
          <div className="px-5 pt-2 pb-3 text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mockup/weekend-vibes.jpg"
              alt="Weekend Vibes"
              className="w-16 h-16 mx-auto rounded-xl mb-2 shadow-lg object-cover"
            />
            <h3 className="text-sm font-bold text-white">Weekend Vibes</h3>
            <div className="flex items-center justify-center gap-1.5 mt-1">
              <div className="flex -space-x-1">
                {[
                  '/images/mockup/member-1.jpg',
                  '/images/mockup/member-2.jpg',
                  '/images/mockup/member-3.jpg',
                ].map((src, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={src}
                    alt={`Member ${i + 1}`}
                    className="w-4 h-4 rounded-full border border-[#081420] object-cover"
                  />
                ))}
              </div>
              <span className="text-[9px] text-white/40">3 members &middot; 8 tracks</span>
            </div>
          </div>

          {/* Tab bar — matches real PlaylistTabs */}
          <div className="flex mx-3 gap-px mb-2 rounded-lg bg-white/5 border border-white/[0.06] p-px">
            {/* Swaplist tab (active) */}
            <div className="flex-1 py-1 rounded-md bg-white/10 text-white text-[8px] font-medium text-center flex items-center justify-center gap-0.5">
              <Music className="w-2 h-2" />
              <span>Swaplist</span>
              <span className="bg-brand text-black text-[6px] font-bold rounded-full px-0.5 min-w-[12px] inline-flex items-center justify-center">
                {inboxCount}
              </span>
            </div>
            {/* Liked tab */}
            <div className="flex-1 py-1 rounded-md text-white/30 text-[8px] text-center flex items-center justify-center gap-0.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-2 h-2"
              >
                <path d="M7 10v12" />
                <path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2a3.13 3.13 0 0 1 3 3.88Z" />
              </svg>
              <span>Liked</span>
              <span className="text-[6px] opacity-60">2</span>
            </div>
            {/* Outcasts tab */}
            <div className="flex-1 py-1 rounded-md text-white/30 text-[8px] text-center flex items-center justify-center gap-0.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="w-2 h-2"
              >
                <path d="M17 14V2" />
                <path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L14 22a3.13 3.13 0 0 1-3-3.88Z" />
              </svg>
              <span>Outcasts</span>
              <span className="text-[6px] opacity-60">1</span>
            </div>
          </div>

          {/* Track rows — animated */}
          <div className="px-3 space-y-1">
            <AnimatePresence mode="popLayout">
              {visibleTracks.map((track) => {
                if (!track) return null;
                const isLevitating = track.id === 'levitating';
                const isBlinding = track.id === 'blinding';
                const isEspresso = track.id === 'espresso';

                return (
                  <m.div
                    key={track.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: 40, transition: { duration: 0.3 } }}
                    transition={springs.gentle}
                  >
                    {/* Swipe hint wrapper for Espresso during reaction */}
                    <m.div
                      className="relative rounded-xl overflow-hidden"
                      animate={isEspresso && phase === 'reaction' ? { x: [0, 15, 0] } : { x: 0 }}
                      transition={
                        isEspresso && phase === 'reaction'
                          ? { duration: 0.6, times: [0, 0.4, 1], ease: 'easeInOut' }
                          : { duration: 0 }
                      }
                    >
                      {/* Green flash behind on swipe */}
                      {isEspresso && (
                        <m.div
                          className="absolute inset-0 bg-gradient-to-r from-accent-green/30 to-accent-green/10 rounded-xl"
                          animate={phase === 'reaction' ? { opacity: [0, 0.6, 0] } : { opacity: 0 }}
                          transition={
                            phase === 'reaction'
                              ? { duration: 0.6, times: [0, 0.3, 1] }
                              : { duration: 0 }
                          }
                        />
                      )}

                      <div
                        className={`flex items-center gap-2 p-2 rounded-xl bg-white/[0.03] relative ${
                          isLevitating || (isEspressoArchiving && isEspresso) ? 'opacity-50' : ''
                        }`}
                      >
                        {/* Album art */}
                        <div className="relative w-10 h-10 rounded-lg shrink-0 overflow-hidden">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={track.src}
                            alt={track.title}
                            className="w-10 h-10 rounded-lg object-cover"
                          />
                          {/* Equalizer bars overlay during listening */}
                          {isEspresso && phase === 'listening' && (
                            <div className="absolute inset-0 bg-black/40 rounded-lg flex items-end justify-center gap-[2px] pb-1.5">
                              {[0, 200, 400].map((delay) => (
                                <span
                                  key={delay}
                                  className="equalizer-bar w-[3px] rounded-full bg-brand"
                                  style={{ animationDelay: `${delay}ms` }}
                                />
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Track info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1">
                            <p className="text-[11px] font-medium text-white truncate">
                              {track.title}
                            </p>
                            {/* Reaction emoji inline */}
                            {isLevitating && <span className="text-[10px]">{'\uD83D\uDD25'}</span>}
                            {isEspresso && showEspressoReaction && (
                              <m.span
                                className="text-[10px]"
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={springs.snappy}
                              >
                                {'\uD83D\uDD25'}
                              </m.span>
                            )}
                            {/* Pending reaction pulse for Espresso */}
                            {isEspresso && phase === 'song-added' && (
                              <svg
                                className="w-3 h-3 text-brand shrink-0 pending-reaction-pulse"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                              >
                                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                              </svg>
                            )}
                          </div>
                          <p className="text-[9px] text-white/35">
                            {isEspresso && phase === 'listening' ? (
                              <span className="text-accent-green">Listening...</span>
                            ) : (
                              <>
                                {track.artist} &middot; {track.time}
                              </>
                            )}
                          </p>
                        </div>

                        {/* Added-by avatar */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={track.addedBy}
                          alt=""
                          className="w-4 h-4 rounded-full object-cover shrink-0"
                        />

                        {/* Progress ring */}
                        {isLevitating && <MockupProgressRing listened={3} total={3} isComplete />}
                        {isBlinding && (
                          <MockupProgressRing listened={2} total={3} isComplete={false} />
                        )}
                        {isEspresso && (
                          <MockupProgressRing
                            listened={espressoListened}
                            total={3}
                            isComplete={espressoComplete}
                          />
                        )}
                      </div>

                      {/* Reaction overlay for Espresso */}
                      <AnimatePresence>
                        {isEspresso && showOverlay && (
                          <m.div
                            className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40 z-10"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={fade}
                          >
                            <m.div
                              className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/[0.12] px-2.5 py-1.5 flex gap-2 shadow-lg shadow-black/60"
                              initial={{ scale: 0.6, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0.6, opacity: 0 }}
                              transition={springs.snappy}
                            >
                              {[
                                '\uD83D\uDC4D',
                                '\uD83D\uDC4E',
                                '\uD83D\uDD25',
                                '\u2764\uFE0F',
                                '\uD83C\uDFB5',
                              ].map((emoji) => (
                                <m.span
                                  key={emoji}
                                  className={`text-[11px] p-1 rounded-xl leading-none transition-all ${
                                    selectedEmoji === emoji
                                      ? 'bg-white/15 ring-1 ring-white/20'
                                      : ''
                                  }`}
                                  animate={selectedEmoji === emoji ? { scale: 1.1 } : { scale: 1 }}
                                  transition={springs.snappy}
                                >
                                  {emoji}
                                </m.span>
                              ))}
                            </m.div>
                          </m.div>
                        )}
                      </AnimatePresence>
                    </m.div>
                  </m.div>
                );
              })}
            </AnimatePresence>
          </div>

          {/* Bottom nav — matches real BottomNav */}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex justify-around items-center py-2.5 rounded-2xl bg-black/80 backdrop-blur-sm border-t border-white/[0.08]">
              <div className="flex flex-col items-center gap-0.5">
                <svg
                  className="w-4 h-4 text-brand"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M9 18V5l12-2v13" />
                  <circle cx="6" cy="18" r="3" />
                  <circle cx="18" cy="16" r="3" />
                </svg>
                <span className="text-[8px] text-brand font-medium">Swaplists</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <svg
                  className="w-4 h-4 text-white/30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <span className="text-[8px] text-white/30">Activity</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <svg
                  className="w-4 h-4 text-white/30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
                <span className="text-[8px] text-white/30">Profile</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Glow — hidden on mobile where phone is cropped */}
      <div className="absolute -inset-16 -z-10 bg-brand/12 rounded-full blur-3xl hidden lg:block" />
    </div>
  );
}

function AnimatedPhoneSection({
  phase,
  listenProgress,
  showOverlay,
  selectedEmoji,
  espressoVisible,
}: {
  phase: MockupPhase;
  listenProgress: number;
  showOverlay: boolean;
  selectedEmoji: string | null;
  espressoVisible: boolean;
}) {
  return (
    <div className="relative">
      <div className="origin-top rotate-0 scale-[1.15] sm:scale-[1.05] lg:rotate-[3deg] lg:scale-[1.55] translate-y-[5%]">
        <PhoneMockup
          phase={phase}
          listenProgress={listenProgress}
          showOverlay={showOverlay}
          selectedEmoji={selectedEmoji}
          espressoVisible={espressoVisible}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Walkthrough controller — drives both narration + phone mockup     */
/* ------------------------------------------------------------------ */

function useWalkthroughController() {
  const prefersReduced = useReducedMotion();
  const [currentStep, setCurrentStep] = useState(0);
  const [phase, setPhase] = useState<MockupPhase>('resting');
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const [listenProgress, setListenProgress] = useState(0);
  const [showOverlay, setShowOverlay] = useState(false);
  const [selectedEmoji, setSelectedEmoji] = useState<string | null>(null);
  const [espressoVisible, setEspressoVisible] = useState(false);

  const idleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const transitionRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heroRef = useRef<HTMLElement | null>(null);

  const totalSteps = WALKTHROUGH_STEPS.length;
  const stepConfig = WALKTHROUGH_STEPS[currentStep]!;

  // Enter a step — set resting briefly, then target phase
  const enterStep = useCallback((stepIdx: number) => {
    if (transitionRef.current) clearTimeout(transitionRef.current);
    setPhase('resting');
    setListenProgress(0);
    setShowOverlay(false);
    setSelectedEmoji(null);
    setEspressoVisible(false);
    transitionRef.current = setTimeout(() => {
      setCurrentStep(stepIdx);
      setPhase(WALKTHROUGH_STEPS[stepIdx]!.phase);
    }, TRANSITION_MS);
  }, []);

  // Auto-play: advance after step duration
  useEffect(() => {
    if (!isAutoPlaying || prefersReduced) return;
    // Don't auto-advance during the resting transition
    if (phase === 'resting' || phase === 'reset') return;

    const timer = setTimeout(() => {
      const next = (currentStep + 1) % totalSteps;
      enterStep(next);
    }, stepConfig.duration);
    return () => clearTimeout(timer);
  }, [
    isAutoPlaying,
    prefersReduced,
    phase,
    currentStep,
    totalSteps,
    stepConfig.duration,
    enterStep,
  ]);

  // Kick off the first step on mount
  useEffect(() => {
    if (prefersReduced) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync initial state on mount
      setPhase(WALKTHROUGH_STEPS[0]!.phase);

      setEspressoVisible(true);
      return;
    }
    const t = setTimeout(() => {
      setPhase(WALKTHROUGH_STEPS[0]!.phase);
    }, TRANSITION_MS);
    return () => clearTimeout(t);
  }, [prefersReduced]);

  // Manual nav helpers
  const pauseAutoPlay = useCallback(() => {
    setIsAutoPlaying(false);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(() => setIsAutoPlaying(true), IDLE_RESUME_MS);
  }, []);

  const goToStep = useCallback(
    (n: number) => {
      const clamped = Math.max(0, Math.min(n, totalSteps - 1));
      pauseAutoPlay();
      enterStep(clamped);
    },
    [totalSteps, pauseAutoPlay, enterStep]
  );

  const goNext = useCallback(() => {
    goToStep((currentStep + 1) % totalSteps);
  }, [currentStep, totalSteps, goToStep]);

  const goPrev = useCallback(() => {
    goToStep((currentStep - 1 + totalSteps) % totalSteps);
  }, [currentStep, totalSteps, goToStep]);

  // Keyboard nav (arrow keys)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [goPrev, goNext]);

  // Sub-timers: listen progress (0 → 1 → 2) — crux is the ring filling, so reach 2/3 early and hold
  useEffect(() => {
    if (phase !== 'listening') {
      setListenProgress(0); // eslint-disable-line react-hooks/set-state-in-effect -- reset on phase change
      return;
    }
    const t1 = setTimeout(() => setListenProgress(1), 1200);
    const t2 = setTimeout(() => setListenProgress(2), 2800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [phase]);

  // Sub-timers: reaction overlay — crux is emoji selection, show it early and hold longer
  useEffect(() => {
    if (phase !== 'reaction') {
      setShowOverlay(false); // eslint-disable-line react-hooks/set-state-in-effect -- reset on phase change
      setSelectedEmoji(null);
      return;
    }
    const t1 = setTimeout(() => setShowOverlay(true), 800);
    const t2 = setTimeout(() => setSelectedEmoji('\uD83D\uDD25'), 1800);
    const t3 = setTimeout(() => setShowOverlay(false), 6000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [phase]);

  // Sub-timers: espresso visibility — crux of archive is the track fading away
  useEffect(() => {
    if (phase === 'song-added' || phase === 'listening' || phase === 'reaction') {
      setEspressoVisible(true); // eslint-disable-line react-hooks/set-state-in-effect -- sync with phase
    } else if (phase === 'archive') {
      setEspressoVisible(true);
      const t = setTimeout(() => setEspressoVisible(false), 3000);
      return () => clearTimeout(t);
    } else {
      setEspressoVisible(false);
    }
  }, [phase]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      if (transitionRef.current) clearTimeout(transitionRef.current);
    };
  }, []);

  return {
    currentStep,
    totalSteps,
    stepConfig,
    phase,
    isAutoPlaying,
    goNext,
    goPrev,
    goToStep,
    heroRef,
    listenProgress,
    showOverlay,
    selectedEmoji,
    espressoVisible,
  };
}

function WalkthroughNarration({
  currentStep,
  onGoToStep,
}: {
  currentStep: number;
  onGoToStep: (n: number) => void;
}) {
  const step = WALKTHROUGH_STEPS[currentStep]!;
  return (
    <>
      {/* Rotating subtitle — fixed height to prevent layout shift */}
      <div className="h-[5.5rem] sm:h-[4rem] relative mb-4 sm:mb-10">
        <AnimatePresence mode="wait">
          <m.p
            key={currentStep}
            className="absolute inset-x-0 top-0 text-lg sm:text-xl font-normal text-white/90 max-w-sm mx-auto lg:mx-0 drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={springs.snappy}
          >
            {step.subtitle}
          </m.p>
        </AnimatePresence>
      </div>

      {/* Clickable step dots — horizontal row */}
      <div className="flex items-center gap-1.5 mt-6 mb-3 sm:mb-8 justify-center lg:justify-start">
        {WALKTHROUGH_STEPS.map((s, i) => (
          <button
            key={s.id}
            onClick={() => onGoToStep(i)}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === currentStep ? 'w-5 bg-brand' : 'w-1.5 bg-white/20 hover:bg-white/40'
            }`}
            aria-label={`Step ${i + 1}`}
          />
        ))}
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Spotify brand icon                                                 */
/* ------------------------------------------------------------------ */

function SpotifyIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={`${className} shrink-0`} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature Showcase — product walkthrough with inline UI mockups       */
/* ------------------------------------------------------------------ */

/** Block 1 visual: circle overview card with scrambling invite code & growing avatars */
function CircleMockup({ isInView }: { isInView: boolean }) {
  const [displayCode, setDisplayCode] = useState('AX7K2M');
  const [memberCount, setMemberCount] = useState(1);
  const [cycle, setCycle] = useState(0);
  const hasStarted = useRef(false);

  useEffect(() => {
    if (!isInView || hasStarted.current) return;
    hasStarted.current = true;

    function randomChar() {
      return SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)]!;
    }
    function generateTarget(): string[] {
      return Array.from({ length: 6 }, randomChar);
    }

    const cleanups: (() => void)[] = [];
    let count = 1;

    function scrambleThenAdvance() {
      const target = generateTarget();
      let tick = 0;
      const totalTicks = 12;

      const interval = setInterval(() => {
        tick++;
        const settled = Math.floor((tick / totalTicks) * 6);
        const display = Array.from({ length: 6 }, (_, i) =>
          i < settled ? target[i]! : randomChar()
        ).join('');
        setDisplayCode(display);

        if (tick >= totalTicks) {
          clearInterval(interval);
          setDisplayCode(target.join(''));
          count++;
          setMemberCount(count);

          if (count >= 6) {
            const t = setTimeout(() => {
              count = 1;
              setMemberCount(1);
              setCycle((c) => c + 1);
              const t2 = setTimeout(scrambleThenAdvance, 600);
              cleanups.push(() => clearTimeout(t2));
            }, 2500);
            cleanups.push(() => clearTimeout(t));
          } else {
            const t = setTimeout(scrambleThenAdvance, 2000);
            cleanups.push(() => clearTimeout(t));
          }
        }
      }, 50);
      cleanups.push(() => clearInterval(interval));
    }

    const t = setTimeout(scrambleThenAdvance, 2000);
    cleanups.push(() => clearTimeout(t));

    return () => cleanups.forEach((fn) => fn());
  }, [isInView]);

  const memberNames = ['Sarah', 'Mike', 'Jess', 'Alex', 'Kate', 'Ryan'];

  return (
    <div className="relative py-4 select-none">
      <div className="absolute -inset-12 bg-brand/[0.06] rounded-full blur-3xl pointer-events-none" />
      <div className="relative rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 sm:p-6">
        {/* Header: icon + name + invite code top-right */}
        <div className="flex items-start gap-3 mb-5">
          <div className="w-11 h-11 rounded-xl bg-brand/15 border border-brand/20 flex items-center justify-center shrink-0">
            <svg
              className="w-5 h-5 text-brand"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M9 18V5l12-2v13" />
              <circle cx="6" cy="18" r="3" />
              <circle cx="18" cy="16" r="3" />
            </svg>
          </div>
          <div className="flex-1 min-w-0 pt-0.5">
            <p className="text-[15px] font-semibold text-white leading-tight">Weekend Crew</p>
            <p className="text-[11px] text-white/35 mt-0.5">
              {`${memberCount} member${memberCount !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] shrink-0">
            <span className="text-[9px] text-white/40 uppercase tracking-wider font-medium hidden sm:inline">
              Invite
            </span>
            <span className="font-mono text-[11px] font-semibold text-brand tracking-widest tabular-nums">
              {displayCode}
            </span>
            <svg
              className="w-3 h-3 text-white/30"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </div>
        </div>

        {/* Growing member avatars */}
        <div className="flex items-center gap-3 mb-5 min-h-9">
          <div className="flex -space-x-2.5">
            {AVATAR_GRADIENTS.slice(0, memberCount).map((gradient, i) => (
              <m.div
                key={`${cycle}-${i}`}
                className={`w-9 h-9 rounded-full border-2 border-[#0d0d0d] bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}
                initial={i === 0 && cycle === 0 ? false : { scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={springs.snappy}
              >
                <span className="text-[10px] font-bold text-white/90">{AVATAR_INITIALS[i]}</span>
              </m.div>
            ))}
          </div>
          {memberCount > 0 && (
            <p className="text-[12px] text-white/40 hidden sm:block">
              {memberNames.slice(0, memberCount).join(', ')}
            </p>
          )}
        </div>

        <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand/10 border border-brand/15">
          <div className="w-1.5 h-1.5 rounded-full bg-brand" />
          <span className="text-[11px] font-medium text-brand">3 Swaplists</span>
        </div>
      </div>
    </div>
  );
}

/** Block 2 visual: playlist detail panel */
function PlaylistPanelMockup() {
  return (
    <div className="relative select-none">
      <div className="absolute -inset-12 bg-accent-green/[0.04] rounded-full blur-3xl pointer-events-none" />
      <div className="relative rounded-2xl bg-white/[0.03] border border-white/[0.06] overflow-hidden">
        <div className="flex items-center gap-3 p-4 pb-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/mockup/weekend-vibes.jpg"
            alt=""
            className="w-10 h-10 rounded-lg object-cover shrink-0"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-white">Weekend Vibes</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <div className="flex -space-x-1">
                {[
                  '/images/mockup/member-1.jpg',
                  '/images/mockup/member-2.jpg',
                  '/images/mockup/member-3.jpg',
                ].map((src, i) => (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="w-3.5 h-3.5 rounded-full border border-[#0a0a0a] object-cover"
                  />
                ))}
              </div>
              <span className="text-[9px] text-white/35">3 members &middot; 8 tracks</span>
            </div>
          </div>
        </div>
        <div className="flex mx-3 gap-1 mb-2.5">
          {[
            { label: 'Swaplist', count: 5, active: true },
            { label: 'Liked', count: 2, active: false },
            { label: 'Outcasts', count: 1, active: false },
          ].map((tab) => (
            <div
              key={tab.label}
              className={`flex-1 text-center py-1.5 rounded-lg text-[10px] font-medium ${
                tab.active ? 'bg-white/10 text-white' : 'text-white/30'
              }`}
            >
              {tab.label}
              <span className={`text-[8px] ml-0.5 ${tab.active ? 'text-brand' : 'text-white/20'}`}>
                {tab.count}
              </span>
            </div>
          ))}
        </div>
        <div className="px-3 pb-3 space-y-1">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mockup/future-nostalgia.jpg"
              alt=""
              className="w-10 h-10 rounded-lg shrink-0 object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1">
                <p className="text-[11px] font-medium text-white truncate">Levitating</p>
                <span className="text-[10px]">🔥</span>
              </div>
              <p className="text-[9px] text-white/35">Dua Lipa &middot; 2h</p>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-brand flex items-center justify-center shrink-0">
              <svg
                className="w-3 h-3 text-brand"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
          </div>
          <div className="relative rounded-xl">
            <div className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/mockup/after-hours.jpg"
                alt=""
                className="w-10 h-10 rounded-lg shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium text-white truncate">Blinding Lights</p>
                <p className="text-[9px] text-white/35">The Weeknd &middot; 1h</p>
              </div>
              <div className="w-6 h-6 shrink-0 relative">
                <svg viewBox="0 0 24 24" className="w-6 h-6 -rotate-90">
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="12"
                    cy="12"
                    r="10"
                    fill="none"
                    stroke="#38BDF8"
                    strokeWidth="2.5"
                    strokeDasharray="42 63"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-[6px] text-white/50 font-medium">
                  2/3
                </span>
              </div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/40">
              <div className="bg-[#1e1e1e] border border-white/20 rounded-full px-2.5 py-1.5 flex gap-2 shadow-lg shadow-black/60">
                {['👍', '👎', '🔥', '❤️', '🎵'].map((e) => (
                  <span key={e} className="text-[11px] leading-none">
                    {e}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/mockup/espresso.jpg"
              alt=""
              className="w-10 h-10 rounded-lg shrink-0 object-cover"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-medium text-white truncate">Espresso</p>
              <p className="text-[9px] text-white/35">Sabrina Carpenter &middot; 30m</p>
            </div>
            <div className="w-6 h-6 rounded-full border-2 border-white/15 flex items-center justify-center shrink-0">
              <span className="text-[6px] text-white/30 font-medium">0/3</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated icon bullets for "shared song inbox" section              */
/* ------------------------------------------------------------------ */
const ICON_DRAW_S = 0.55;
const TEXT_FALL_S = 0.3;
const ITEM_GAP_S = 0.15;
const ITEM_TOTAL_S = ICON_DRAW_S + TEXT_FALL_S + ITEM_GAP_S;
// Extra delay so the parent block's entrance animation settles first
const BULLETS_INITIAL_DELAY = 0.35;

function AnimatedPlus({ inView, delay }: { inView: boolean; delay: number }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <m.line
        x1="12"
        y1="5"
        x2="12"
        y2="19"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: ICON_DRAW_S * 0.55, delay, ease: 'easeOut' }}
      />
      <m.line
        x1="5"
        y1="12"
        x2="19"
        y2="12"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{
          duration: ICON_DRAW_S * 0.55,
          delay: delay + ICON_DRAW_S * 0.35,
          ease: 'easeOut',
        }}
      />
    </svg>
  );
}

function AnimatedHeart({ inView, delay }: { inView: boolean; delay: number }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <m.path
        d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: ICON_DRAW_S, delay, ease: 'easeOut' }}
      />
    </svg>
  );
}

function AnimatedArchive({ inView, delay }: { inView: boolean; delay: number }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <m.rect
        width="20"
        height="5"
        x="2"
        y="3"
        rx="1"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{ duration: ICON_DRAW_S * 0.45, delay, ease: 'easeOut' }}
      />
      <m.path
        d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{
          duration: ICON_DRAW_S * 0.45,
          delay: delay + ICON_DRAW_S * 0.35,
          ease: 'easeOut',
        }}
      />
      <m.path
        d="M10 12h4"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={inView ? { pathLength: 1, opacity: 1 } : {}}
        transition={{
          duration: ICON_DRAW_S * 0.25,
          delay: delay + ICON_DRAW_S * 0.7,
          ease: 'easeOut',
        }}
      />
    </svg>
  );
}

const INBOX_BULLETS = [
  { key: 'add', text: 'Friends add tracks to the shared inbox' },
  { key: 'react', text: 'React with swipe or double-tap' },
  { key: 'archive', text: 'Tracks archive when everyone listens' },
] as const;

function InboxBullets({ inView }: { inView: boolean }) {
  return (
    <div className="space-y-3">
      {INBOX_BULLETS.map((item, i) => {
        const iconDelay = BULLETS_INITIAL_DELAY + i * ITEM_TOTAL_S;
        const textDelay = iconDelay + ICON_DRAW_S;

        return (
          <div key={item.key} className="flex items-center gap-3">
            <span className="w-6 shrink-0 flex items-center justify-center text-brand">
              {item.key === 'add' && <AnimatedPlus inView={inView} delay={iconDelay} />}
              {item.key === 'react' && <AnimatedHeart inView={inView} delay={iconDelay} />}
              {item.key === 'archive' && <AnimatedArchive inView={inView} delay={iconDelay} />}
            </span>
            <m.span
              className="text-sm text-white/45"
              initial={{ opacity: 0, y: 8 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: TEXT_FALL_S, delay: textDelay, ease: 'easeOut' }}
            >
              {item.text}
            </m.span>
          </div>
        );
      })}
    </div>
  );
}

const SCRAMBLE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const AVATAR_GRADIENTS = [
  'from-sky-400 to-blue-500',
  'from-emerald-400 to-teal-500',
  'from-violet-400 to-purple-500',
  'from-amber-400 to-orange-500',
  'from-pink-400 to-rose-500',
  'from-cyan-400 to-teal-500',
];
const AVATAR_INITIALS = ['S', 'M', 'J', 'A', 'K', 'R'];

/** Block 4: role capabilities */
const ROLE_CAPABILITIES = [
  {
    key: 'create',
    label: 'Create swaplists',
    tip: 'Start new collaborative playlists for the circle',
    icon: CirclePlus,
  },
  {
    key: 'invite',
    label: 'Invite members',
    tip: 'Send invite links to bring friends into the circle',
    icon: Share2,
  },
  {
    key: 'add',
    label: 'Add tracks',
    tip: 'Search Spotify and add songs to any swaplist',
    icon: Music,
  },
  {
    key: 'react',
    label: 'React & swipe',
    tip: 'Swipe right to keep, left to skip — vote on tracks',
    icon: Heart,
  },
  {
    key: 'listen',
    label: 'Listening stats',
    tip: "See who's actually listening and how often",
    icon: Headphones,
  },
  {
    key: 'settings',
    label: 'Playlist settings',
    tip: 'Change playlist name, description, and cover art',
    icon: Settings,
  },
  {
    key: 'moderate',
    label: 'Moderate members',
    tip: 'Remove members and manage circle access',
    icon: Shield,
  },
] as const;

type CapKey = (typeof ROLE_CAPABILITIES)[number]['key'];

const SHOWCASE_ROLES: {
  name: string;
  desc: string;
  tip: string;
  icon: typeof Crown;
  color: string;
  border: string;
  bg: string;
  activeColor: string;
  enabled: Set<CapKey>;
}[] = [
  {
    name: 'Host',
    desc: 'Creates the circle',
    tip: 'The circle owner — connects their Spotify app and has full control over the circle and all its swaplists.',
    icon: Crown,
    color: 'text-brand',
    border: 'border-brand/25',
    bg: 'bg-brand/10',
    activeColor: 'text-brand',
    enabled: new Set(['create', 'invite', 'add', 'react', 'listen', 'settings', 'moderate']),
  },
  {
    name: 'Member',
    desc: 'Joins via invite',
    tip: 'Full circle member — can do everything except moderate others. Joins through an invite link.',
    icon: UserPlus,
    color: 'text-accent-green',
    border: 'border-accent-green/25',
    bg: 'bg-accent-green/10',
    activeColor: 'text-accent-green',
    enabled: new Set(['invite', 'add', 'react', 'listen', 'settings']),
  },
  {
    name: 'Collaborator',
    desc: 'Adds via Spotify',
    tip: "External contributor — anyone who adds tracks directly through Spotify. Can add and react but doesn't manage the circle.",
    icon: Music,
    color: 'text-white/40',
    border: 'border-white/[0.08]',
    bg: 'bg-white/[0.05]',
    activeColor: 'text-white/60',
    enabled: new Set(['add', 'react']),
  },
];

const DOCK_BASE_SIZE = 14;
const DOCK_MAX_SIZE = 26;
const DOCK_MAGNIFY_RADIUS = 80; // px distance over which magnification falls off

function DockIcon({
  cap,
  active,
  activeColor,
  mouseX,
}: {
  cap: (typeof ROLE_CAPABILITIES)[number];
  active: boolean;
  activeColor: string;
  mouseX: MotionValue<number>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (mx) => {
    if (mx < 0) return Infinity; // mouse not in container
    const el = ref.current;
    if (!el) return Infinity;
    const rect = el.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    return Math.abs(mx - center);
  });

  const size = useTransform(distance, (d) => {
    if (!isFinite(d)) return DOCK_BASE_SIZE;
    const ratio = Math.max(0, 1 - d / DOCK_MAGNIFY_RADIUS);
    // Smooth gaussian-like falloff
    const smooth = ratio * ratio * (3 - 2 * ratio); // smoothstep
    return DOCK_BASE_SIZE + (DOCK_MAX_SIZE - DOCK_BASE_SIZE) * smooth;
  });

  const springSize = useSpring(size, { stiffness: 400, damping: 25 });

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <m.div
          ref={ref}
          className="relative cursor-pointer origin-bottom"
          style={{ width: springSize, height: springSize }}
        >
          <cap.icon
            className={`w-full h-full transition-colors ${active ? activeColor : 'text-white/10'}`}
          />
          {!active && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-[140%] h-px bg-white/20 -rotate-45" />
            </div>
          )}
        </m.div>
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={6} className="max-w-44">
        <p className="font-medium">{cap.label}</p>
        <p className="opacity-60 font-normal">{cap.tip}</p>
      </TooltipContent>
    </Tooltip>
  );
}

function DockCapRow({ role }: { role: (typeof SHOWCASE_ROLES)[number] }) {
  const mouseX = useMotionValue(-1);

  return (
    <div
      className="flex items-end justify-between h-7 overflow-hidden max-w-[280px] mx-auto"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(-1)}
    >
      {ROLE_CAPABILITIES.map((cap) => (
        <DockIcon
          key={cap.key}
          cap={cap}
          active={role.enabled.has(cap.key)}
          activeColor={role.activeColor}
          mouseX={mouseX}
        />
      ))}
    </div>
  );
}

function RoleCardsMockup({ isInView }: { isInView: boolean }) {
  const [hoveredCard, setHoveredCard] = useState(-1);

  return (
    <TooltipProvider delayDuration={200}>
      <div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3 select-none"
        onMouseLeave={() => setHoveredCard(-1)}
      >
        {SHOWCASE_ROLES.map((role, i) => {
          const isHovered = hoveredCard === i;
          const hasSibling = hoveredCard >= 0 && !isHovered;
          return (
            <m.div
              key={role.name}
              onMouseEnter={() => setHoveredCard(i)}
              initial={{ opacity: 0, y: 24 }}
              animate={
                isInView
                  ? {
                      opacity: 1,
                      y: 0,
                      scale: isHovered ? 1.05 : hasSibling ? 0.97 : 1,
                      filter: hasSibling ? 'blur(1.5px)' : 'blur(0px)',
                    }
                  : {}
              }
              transition={{ ...springs.snappy }}
              style={{ transformOrigin: 'center center' }}
              className={`rounded-xl bg-white/3 border ${role.border} p-4 text-center transition-shadow ${isHovered ? 'shadow-lg shadow-white/5 z-10' : ''}`}
            >
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="cursor-help">
                    <div
                      className={`w-10 h-10 rounded-full ${role.bg} flex items-center justify-center mx-auto mb-3`}
                    >
                      <role.icon className={`w-5 h-5 ${role.color}`} />
                    </div>
                    <p className={`text-sm font-semibold ${role.color} mb-0.5`}>{role.name}</p>
                    <p className="text-[11px] text-white/35 mb-3">{role.desc}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" sideOffset={8} className="max-w-50">
                  {role.tip}
                </TooltipContent>
              </Tooltip>
              <DockCapRow role={role} />
              <p className="text-[9px] text-white/25 mt-2">
                {role.enabled.size}/{ROLE_CAPABILITIES.length} capabilities
              </p>
            </m.div>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

/** Main showcase section replacing FeatureCards */
function FeatureShowcase({ onGetStarted }: { onGetStarted: () => void }) {
  const b1Ref = useRef<HTMLDivElement>(null);
  const b1InView = useInView(b1Ref, { once: true, margin: '-80px' });
  const b2Ref = useRef<HTMLDivElement>(null);
  const b2InView = useInView(b2Ref, { once: true, margin: '-80px' });
  const b4Ref = useRef<HTMLDivElement>(null);
  const b4InView = useInView(b4Ref, { once: true, margin: '-80px' });
  const ctaRef = useRef<HTMLDivElement>(null);
  const ctaInView = useInView(ctaRef, { once: true, margin: '-80px' });

  const ctaVideoRef = useRef<HTMLVideoElement>(null);
  // once: false so video replays when user scrolls back into view
  const ctaVideoInView = useInView(ctaRef, { margin: '-60px' });

  useEffect(() => {
    const video = ctaVideoRef.current;
    if (!video) return;
    if (ctaVideoInView) {
      video.currentTime = 0;
      video.play().catch(() => {});
    } else {
      video.pause();
    }
  }, [ctaVideoInView]);

  return (
    <section id="how-it-works" className="relative px-5 py-20 sm:py-28">
      <div className="absolute inset-0 aurora-accent opacity-50" />

      <div className="relative max-w-5xl mx-auto space-y-20 sm:space-y-28">
        {/* Block 1: All your circles in one app */}
        <m.div
          ref={b1Ref}
          initial={{ opacity: 0, y: 40 }}
          animate={b1InView ? { opacity: 1, y: 0 } : {}}
          transition={springs.gentle}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        >
          <div>
            <h3 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-4">
              All your circles in one app
            </h3>
            <p className="text-base text-white/50 leading-relaxed">
              Create a circle for your friend group. Invite them in, and start sharing music
              together. Everyone can be in multiple circles for different crews.
            </p>
          </div>
          <CircleMockup isInView={b1InView} />
        </m.div>

        {/* Block 2: A shared song inbox (flipped) */}
        <m.div
          ref={b2Ref}
          initial={{ opacity: 0, y: 40 }}
          animate={b2InView ? { opacity: 1, y: 0 } : {}}
          transition={springs.gentle}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        >
          <div className="lg:order-2">
            <h3 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-4">
              A shared song inbox
            </h3>
            <p className="text-base text-white/50 leading-relaxed mb-6">
              Everyone drops tracks in. Listen through each other&apos;s picks, react with emoji,
              and the queue clears itself.
            </p>
            <InboxBullets inView={b2InView} />
          </div>
          <div className="lg:order-1">
            <PlaylistPanelMockup />
          </div>
        </m.div>

        {/* Block 3: Everyone plays a part */}
        <m.div
          ref={b4Ref}
          initial={{ opacity: 0, y: 40 }}
          animate={b4InView ? { opacity: 1, y: 0 } : {}}
          transition={springs.gentle}
          className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center"
        >
          <div>
            <h3 className="font-heading text-2xl sm:text-3xl font-bold text-white mb-4">
              Everyone pl
              <Play className="inline-block w-[0.6em] h-[0.6em] relative top-[-0.05em] fill-current" />
              ys a part
            </h3>
            <p className="text-base text-white/50 leading-relaxed">
              From hosts who run the show to collaborators who just drop tracks. Different roles,
              different capabilities &mdash; everyone contributes their way.
            </p>
          </div>
          <RoleCardsMockup isInView={b4InView} />
        </m.div>

        {/* Bottom CTA — video spotlight */}
        <m.div
          ref={ctaRef}
          className="relative"
          initial={{ opacity: 0, y: 20 }}
          animate={ctaInView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...springs.gentle, delay: 0.2 }}
        >
          {/* The card */}
          <div
            className="relative overflow-hidden rounded-2xl animate-[aurora-pulse_6s_ease-in-out_infinite]"
            style={{
              boxShadow:
                '0 40px 120px 20px rgba(56, 189, 248, 0.15), 0 20px 60px 10px rgba(74, 222, 128, 0.10)',
            }}
          >
            {/* Background video */}
            <video
              ref={ctaVideoRef}
              className="absolute inset-0 w-full h-full object-cover pointer-events-none"
              src="/videos/cta-spotlight.mp4"
              muted
              playsInline
              preload="auto"
            />
            {/* Gradient overlay for text readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/40 to-black/50" />

            {/* Content */}
            <div className="relative z-10 text-center py-20 sm:py-28 px-6">
              <p
                className="font-display text-2xl sm:text-3xl text-white mb-6"
                style={{ textShadow: '0 2px 16px rgba(0,0,0,0.7), 0 0 40px rgba(0,0,0,0.4)' }}
              >
                It&apos;s time to showcase your taste.
              </p>
              <button
                onClick={onGetStarted}
                className="btn-pill text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4 relative overflow-hidden bg-accent-green text-black hover:bg-accent-green/90 active:scale-[0.98] hover:scale-[1.02] transition-[transform,background-color] duration-200 font-heading glow-green btn-shimmer"
                style={{ textShadow: 'none' }}
              >
                <SpotifyIcon />
                Get Started
              </button>
            </div>
          </div>

          {/* Hovering drop shadow — elliptical black shadow on the "ground" */}
          <div
            className="absolute left-1/2 -translate-x-1/2 -bottom-6 w-[70%] h-8 rounded-[100%] pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.5) 0%, transparent 70%)',
            }}
          />
        </m.div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/*  Animated logo wordmark                                              */
/* ------------------------------------------------------------------ */

const LOGO_LETTERS = ['S', 'w', 'a', 'p', 'i', 'f', 'y'];
const LAST_IDX = LOGO_LETTERS.length - 1;

// ── Timing (slowed way down) ──
const STAGGER_IN = 0.18; // gap between each letter arriving (L→R)
const DROP_IN_DURATION = 0.8; // how long each letter takes to land
const HOLD_MS = 2000; // pause while fully readable
const STAGGER_OUT = 0.14; // gap between each letter falling (R→L)
const FALL_DURATION = 0.7; // how long each letter takes to tumble off

function AnimatedWordmark() {
  const [phase, setPhase] = useState<'drop' | 'fall' | 'static'>('drop');
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion) {
      setPhase('static'); // eslint-disable-line react-hooks/set-state-in-effect -- skip animations
      return;
    }
    if (phase === 'drop') {
      const totalDrop = (DROP_IN_DURATION + LAST_IDX * STAGGER_IN) * 1000 + HOLD_MS;
      const t = setTimeout(() => setPhase('fall'), totalDrop);
      return () => clearTimeout(t);
    }
    if (phase === 'fall') {
      const totalFall = (FALL_DURATION + LAST_IDX * STAGGER_OUT) * 1000 + 500;
      const t = setTimeout(() => setPhase('static'), totalFall);
      return () => clearTimeout(t);
    }
  }, [phase, prefersReducedMotion]);

  if (phase === 'static') {
    return (
      <m.span
        initial={prefersReducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6 }}
        className="font-display text-2xl sm:text-3xl text-white"
      >
        Swapify
      </m.span>
    );
  }

  return (
    <span className="overflow-hidden h-8 sm:h-9 flex items-center">
      <span className="flex">
        {LOGO_LETTERS.map((letter, i) => {
          // Drop in: L→R (S first, y last)
          // Fall off: R→L (y first, S last)
          const reverseIdx = LAST_IDX - i;

          return (
            <m.span
              key={i}
              className="font-display text-2xl sm:text-3xl text-white inline-block"
              style={{ transformOrigin: 'bottom center' }}
              initial={{ y: -36, rotate: -16, opacity: 0 }}
              animate={
                phase === 'drop'
                  ? { y: 0, rotate: 0, opacity: 1 }
                  : { y: 44, rotate: 20 + reverseIdx * 3, opacity: 0 }
              }
              transition={
                phase === 'drop'
                  ? {
                      delay: i * STAGGER_IN,
                      duration: DROP_IN_DURATION,
                      ease: [0.34, 1.56, 0.64, 1],
                    }
                  : {
                      delay: reverseIdx * STAGGER_OUT,
                      duration: FALL_DURATION,
                      ease: [0.55, 0, 1, 0.45],
                    }
              }
            >
              {letter}
            </m.span>
          );
        })}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing header bar                                                  */
/* ------------------------------------------------------------------ */

function LandingHeader({
  onContact,
  onGetStarted,
}: {
  onContact: () => void;
  onGetStarted: () => void;
}) {
  return (
    <m.header
      className="fixed top-0 left-0 right-0 z-50 backdrop-blur-2xl bg-white/[0.03] border-b border-white/[0.06]"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springs.gentle, delay: 0.05 }}
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-18 sm:h-16 flex items-center justify-between">
        {/* Logo + animated wordmark */}
        <a href="#" className="flex items-center gap-2.5 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/swapify-logo.svg"
            alt=""
            className="w-7 h-7 sm:w-8 sm:h-8 brightness-0 invert"
          />
          <AnimatedWordmark />
        </a>

        {/* Nav links */}
        <nav className="flex items-center gap-1">
          <button
            onClick={onContact}
            className="hidden sm:inline-flex items-center px-3.5 h-8 text-sm font-medium text-white/90 hover:text-white hover:bg-white/8 rounded-full transition-all"
          >
            Contact
          </button>
          {/* Mobile: Get Started in header */}
          <button
            onClick={onGetStarted}
            className="sm:hidden inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-black bg-accent-green hover:bg-accent-green/90 rounded-full transition-all"
          >
            <SpotifyIcon className="w-3.5 h-3.5" />
            Get Started
          </button>
        </nav>
      </div>
    </m.header>
  );
}

/* ------------------------------------------------------------------ */
/*  Contact modal                                                       */
/* ------------------------------------------------------------------ */

function ContactModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-[var(--surface-elevated)] border-white/[0.08] backdrop-blur-2xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-text-primary">Contact Us</DialogTitle>
          <DialogDescription className="sr-only">
            Get in touch with the Swapify team
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Have questions, feedback, or just want to say hi? Reach out and we&apos;ll get back to
            you.
          </p>
          <a
            href="mailto:ope@312.dev"
            className="btn-pill btn-pill-primary w-full flex items-center justify-center gap-2"
          >
            <Mail className="w-4 h-4" />
            ope@312.dev
          </a>
          <div className="flex items-center gap-4 justify-center pt-2">
            <a
              href="https://github.com/312-dev/swapify"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <Github className="w-4 h-4" />
              GitHub
            </a>
            <a
              href="https://312.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <Globe className="w-4 h-4" />
              312.dev
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing page                                                       */
/* ------------------------------------------------------------------ */

export default function LandingClient() {
  const [showGetStarted, setShowGetStarted] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [signInQuery, setSignInQuery] = useState('');
  const [signInError, setSignInError] = useState('');
  const [isSignInLooking, setIsSignInLooking] = useState(false);
  const [showContact, setShowContact] = useState(false);

  const walkthrough = useWalkthroughController();

  async function handleJoinSubmit() {
    if (!joinCode.trim()) return;
    setIsResolving(true);
    setJoinError('');
    try {
      const res = await fetch(`/api/playlists/resolve?code=${encodeURIComponent(joinCode.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite code');
      }
      const data = await res.json();
      const trimmedCode = encodeURIComponent(joinCode.trim());
      if (data.type === 'circle') {
        window.location.href = `/circle/join?code=${trimmedCode}`;
      } else {
        window.location.href = `/playlist/join?code=${trimmedCode}`;
      }
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setIsResolving(false);
    }
  }

  async function handleSignInLookup() {
    if (!signInQuery.trim()) return;
    setIsSignInLooking(true);
    setSignInError('');
    try {
      const res = await fetch(`/api/auth/lookup?q=${encodeURIComponent(signInQuery.trim())}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'No account found');
      }
      const data = await res.json();
      const params = new URLSearchParams({
        clientId: data.spotifyClientId,
        circleId: data.circleId,
        circleAction: 'reauth',
        returnTo: '/dashboard',
      });
      window.location.href = `/api/auth/login?${params}`;
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Something went wrong');
      setIsSignInLooking(false);
    }
  }

  return (
    <div className="min-h-dvh overflow-x-hidden flex flex-col">
      {/* ───────── Header bar ───────── */}
      <LandingHeader
        onContact={() => setShowContact(true)}
        onGetStarted={() => setShowGetStarted(true)}
      />

      {/* ───────── Hero — full viewport, content at bottom ───────── */}
      <section className="relative min-h-dvh flex flex-col justify-end lg:justify-center overflow-clip">
        {/* Video background */}
        <HeroVideoBackground />

        {/* Overlay — lighter at top to let video breathe, darker at bottom for text */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#081420]/80 via-[#081420]/85 to-[#0a0a0a]/95 sm:from-[#081420]/30 sm:via-[#081420]/40" />

        {/* Color glow layer */}
        <div className="landing-glow" />

        {/* Text content */}
        <div className="relative z-10 w-full pt-24 sm:pt-28 lg:pt-0">
          <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 lg:py-12">
            <div className="flex flex-col text-center lg:text-left max-w-lg lg:max-w-xl mx-auto lg:mx-0">
              {/* Headline — mixed typography */}
              <h1 className="mb-5 sm:mb-6 leading-[0.92] order-2 lg:order-1">
                {[
                  {
                    text: 'Share the aux,',
                    className:
                      'font-heading text-[2.25rem] sm:text-5xl lg:text-6xl font-bold text-white',
                  },
                  {
                    text: 'keep the bops',
                    className:
                      'font-display text-[2.25rem] sm:text-5xl lg:text-6xl text-brand mt-1',
                  },
                ].map((line, i) => (
                  <span key={i} className="block overflow-clip pt-[0.05em] pb-[0.3em]">
                    <m.span
                      className={`block ${line.className}`}
                      initial={{ y: '110%' }}
                      animate={{ y: '0%' }}
                      transition={{
                        type: 'spring',
                        stiffness: 70,
                        damping: 18,
                        delay: 0.2 + i * 0.15,
                      }}
                    >
                      {line.text}
                    </m.span>
                  </span>
                ))}
              </h1>

              {/* Rotating subtitle — synced to phone demo */}
              <m.div
                className="order-3 lg:order-2"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: 0.6 }}
              >
                <WalkthroughNarration
                  currentStep={walkthrough.currentStep}
                  onGoToStep={walkthrough.goToStep}
                />
              </m.div>

              {/* CTAs — hidden on mobile (Get Started is in header), shown on sm+ */}
              <m.div
                className="hidden sm:flex flex-col items-center lg:items-start gap-3 justify-center lg:justify-start order-1 lg:order-3 mb-8 lg:mb-0"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: 0.8 }}
              >
                <button
                  onClick={() => setShowGetStarted(true)}
                  className="btn-pill relative overflow-hidden bg-accent-green text-black hover:bg-accent-green/90 active:scale-[0.98] hover:scale-[1.02] transition-[transform,background-color] duration-200 font-heading glow-green btn-shimmer"
                  style={{ fontSize: '17px', padding: '13px 26px' }}
                >
                  <SpotifyIcon />
                  Get Started
                </button>
                <p className="text-sm text-white/50 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">
                  Already have an account?{' '}
                  <button
                    onClick={() => setShowSignIn(true)}
                    className="text-white/70 hover:text-white underline underline-offset-2 decoration-white/30 hover:decoration-white/60 transition-colors"
                  >
                    Sign in
                  </button>
                </p>
              </m.div>
            </div>
          </div>
        </div>

        {/* Phone — centered below text on mobile (in-flow, cropped ~50%), vertically centered on right for desktop (absolute) */}
        <m.div
          className="relative flex justify-center items-start pt-2 sm:pt-8 lg:pt-0 lg:flex-none lg:absolute lg:top-0 lg:h-full lg:right-[12%] z-20 pointer-events-none lg:items-center overflow-hidden lg:overflow-visible max-h-[48vh] sm:max-h-[55vh] lg:max-h-none"
          initial={{ opacity: 0, y: 60 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.4 }}
        >
          <AnimatedPhoneSection
            phase={walkthrough.phase}
            listenProgress={walkthrough.listenProgress}
            showOverlay={walkthrough.showOverlay}
            selectedEmoji={walkthrough.selectedEmoji}
            espressoVisible={walkthrough.espressoVisible}
          />
        </m.div>
      </section>

      {/* ───────── Feature showcase ───────── */}
      <FeatureShowcase onGetStarted={() => setShowGetStarted(true)} />

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-glass-border">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <p className="text-xs text-text-tertiary" suppressHydrationWarning>
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://312.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-secondary transition-colors"
            >
              312.dev LLC
            </a>{' '}
            &middot; Made with <Pizza className="inline-block w-3.5 h-3.5 mx-0.5 -mt-0.5" /> in
            Chicago
            <span className="hidden sm:inline">
              {' '}
              &middot; Built on Spotify. Icon by{' '}
              <a
                href="https://thenounproject.com/icon/share-song-7686374/"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-text-secondary transition-colors"
              >
                S. Belalcazar Lareo
              </a>
              . Videos by{' '}
              <a
                href="https://www.pexels.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-text-secondary transition-colors"
              >
                Pexels
              </a>
            </span>
          </p>

          <div className="flex items-center gap-4 shrink-0">
            <a
              href="https://github.com/312-dev/swapify"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-tertiary hover:text-text-primary transition-colors"
              aria-label="GitHub repository"
              title="GitHub"
            >
              <Github className="w-4 h-4" />
            </a>
            <a
              href="mailto:ope@312.dev"
              className="text-text-tertiary hover:text-text-primary transition-colors"
              aria-label="Email us"
              title="ope@312.dev"
            >
              <Mail className="w-4 h-4" />
            </a>
            <a
              href="https://312.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-tertiary hover:text-text-primary transition-colors"
              aria-label="312.dev"
              title="312.dev"
            >
              <Globe className="w-4 h-4" />
            </a>
          </div>
        </div>
      </footer>

      {/* Get Started dialog */}
      <Dialog
        open={showGetStarted}
        onOpenChange={(open) => {
          if (!open) {
            setShowGetStarted(false);
            setJoinCode('');
            setJoinError('');
          }
        }}
      >
        <DialogContent className="bg-[var(--surface-elevated)] border-white/[0.08] backdrop-blur-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-text-primary">Get Started</DialogTitle>
            <DialogDescription className="sr-only">Start or join a Swaplist</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {/* Start a Swaplist */}
            <button
              onClick={() => {
                setShowGetStarted(false);
                setShowSetupWizard(true);
              }}
              className="w-full rounded-xl p-4 text-left active:scale-[0.98] transition-transform group bg-white/4 border border-white/6 hover:bg-white/7"
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand/15 shrink-0">
                  <Plus className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-text-primary group-hover:text-brand transition-colors">
                    Start a Swaplist
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">
                    Start a shared song inbox with your crew
                  </p>
                </div>
                <svg
                  className="w-5 h-5 text-text-tertiary group-hover:text-brand transition-colors shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>

            {/* Join a Swaplist */}
            <div className="w-full rounded-xl p-4 bg-white/4 border border-white/6">
              <div className="flex items-start gap-4 mb-3">
                <div className="flex items-center justify-center w-10 h-10 rounded-full bg-brand/15 shrink-0">
                  <UserPlus className="w-5 h-5 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-semibold text-text-primary mb-1">Join a Swaplist</h3>
                  <p className="text-sm text-text-secondary">
                    I have an invite link or code from a friend
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => {
                    setJoinCode(e.target.value);
                    setJoinError('');
                  }}
                  placeholder="Enter invite code"
                  className="input-glass flex-1 text-sm"
                  maxLength={10}
                  enterKeyHint="go"
                  autoComplete="off"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
                <button
                  onClick={handleJoinSubmit}
                  disabled={!joinCode.trim() || isResolving}
                  className="btn-pill btn-pill-primary btn-pill-sm shrink-0 disabled:opacity-50"
                >
                  {isResolving ? 'Looking up...' : 'Join'}
                </button>
              </div>
              {joinError && <p className="text-xs text-danger mt-2">{joinError}</p>}
              <p className="text-sm text-text-tertiary mt-2">
                Or open the invite link your host sent you directly
              </p>
            </div>

            {/* Divider + sign back in */}
            <div className="relative flex items-center gap-3 pt-1">
              <div className="flex-1 h-px bg-white/8" />
              <span className="text-xs text-text-tertiary uppercase tracking-wider">or</span>
              <div className="flex-1 h-px bg-white/8" />
            </div>
            <button
              onClick={() => {
                setShowGetStarted(false);
                setJoinCode('');
                setJoinError('');
                setShowSignIn(true);
              }}
              className="w-full text-center text-sm text-text-secondary hover:text-brand transition-colors py-1"
            >
              Already have an account? <span className="text-brand font-medium">Sign back in</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Setup Wizard for hosts */}
      <SpotifySetupWizard isOpen={showSetupWizard} onClose={() => setShowSetupWizard(false)} />

      {/* Sign back in dialog */}
      <Dialog
        open={showSignIn}
        onOpenChange={(open) => {
          if (!open) {
            setShowSignIn(false);
            setSignInQuery('');
            setSignInError('');
          }
        }}
      >
        <DialogContent className="bg-[var(--surface-elevated)] border-white/[0.08] backdrop-blur-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-text-primary">
              Sign in or sign up
            </DialogTitle>
            <DialogDescription className="sr-only">
              Find your existing account or create a new one
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Enter your Spotify username or email to find your account, or get started as a new
              host.
            </p>
            <input
              type="text"
              value={signInQuery}
              onChange={(e) => {
                setSignInQuery(e.target.value);
                setSignInError('');
              }}
              placeholder="Spotify username or email"
              className="input-glass w-full"
              onKeyDown={(e) => e.key === 'Enter' && handleSignInLookup()}
              autoComplete="username"
              enterKeyHint="go"
            />
            <button
              onClick={handleSignInLookup}
              disabled={!signInQuery.trim() || isSignInLooking}
              className="btn-pill btn-pill-primary w-full disabled:opacity-50"
            >
              {isSignInLooking ? 'Looking up...' : 'Continue'}
            </button>
            {signInError && (
              <div className="mt-2 space-y-3">
                <p className="text-xs text-danger">{signInError}</p>
                <div className="rounded-lg border border-white/8 bg-white/4 p-3">
                  <p className="text-sm text-text-secondary mb-2.5">
                    Don&apos;t have an account yet? Start a Swaplist as a host.
                  </p>
                  <button
                    onClick={() => {
                      setShowSignIn(false);
                      setSignInQuery('');
                      setSignInError('');
                      setShowSetupWizard(true);
                    }}
                    className="btn-pill btn-pill-secondary w-full text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Sign up as a host
                  </button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Contact modal */}
      <ContactModal open={showContact} onOpenChange={setShowContact} />
    </div>
  );
}
