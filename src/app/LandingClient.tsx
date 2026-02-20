'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { m, useInView } from 'motion/react';
import { Globe, Mail, Plus, UserPlus } from 'lucide-react';
import { AudioLinesIcon, type AudioLinesIconHandle } from '@/components/ui/audio-lines';
import { FlameIcon, type FlameIconHandle } from '@/components/ui/flame';
import { HandMetalIcon, type HandMetalIconHandle } from '@/components/ui/hand-metal';
import { springs } from '@/lib/motion';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import SpotifySetupWizard from '@/components/SpotifySetupWizard';
import SpotifyChangesBanner from '@/components/SpotifyChangesBanner';

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
/*  Accurate phone mockup — playlist detail with swipe-on-row         */
/* ------------------------------------------------------------------ */

function PhoneMockup() {
  const coverUrl = '/images/mockup/weekend-vibes.jpg';
  const albumColors = useAlbumColors(coverUrl);

  return (
    <div className="relative mx-auto w-[220px] sm:w-[260px] lg:w-[290px]">
      {/* Frame */}
      <div className="rounded-[2.5rem] border-[3px] border-white/[0.12] bg-black p-3 shadow-2xl shadow-black/60">
        {/* Dynamic island */}
        <div className="absolute top-[14px] left-1/2 -translate-x-1/2 w-[90px] h-[25px] bg-black rounded-full z-20" />

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
          {/* Status bar */}
          <div className="flex justify-between items-center px-6 pt-4 pb-1 text-[10px]">
            <span className="font-semibold text-white/70">9:41</span>
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

          {/* Tab bar */}
          <div className="flex mx-4 gap-1 mb-2.5">
            {[
              { label: 'Inbox', count: 5, active: true },
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
                {tab.count !== null && tab.count !== undefined && (
                  <span className="text-[8px] text-brand ml-0.5">{tab.count}</span>
                )}
              </div>
            ))}
          </div>

          {/* Track rows */}
          <div className="px-3 space-y-1">
            {/* Row 1 — Levitating */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/mockup/future-nostalgia.jpg"
                alt="Future Nostalgia"
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
                <span className="text-[7px] text-brand font-bold">&#10003;</span>
              </div>
            </div>

            {/* Row 2 — Blinding Lights with reaction bar overlay */}
            <div className="relative rounded-xl">
              <div className="flex items-center gap-2 p-2 bg-white/[0.03] rounded-xl">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/images/mockup/after-hours.jpg"
                  alt="After Hours"
                  className="w-10 h-10 rounded-lg shrink-0 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium text-white truncate">Blinding Lights</p>
                  <p className="text-[9px] text-white/35">The Weeknd &middot; 1h</p>
                </div>
                {/* Progress ring — partial */}
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
              {/* Reaction bar overlay */}
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

            {/* Row 3 — Espresso, pending reaction */}
            <div className="flex items-center gap-2 p-2 rounded-xl bg-white/[0.03]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/mockup/espresso.jpg"
                alt="Espresso"
                className="w-10 h-10 rounded-lg shrink-0 object-cover"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <p className="text-[11px] font-medium text-white truncate">Espresso</p>
                  <svg
                    className="w-3 h-3 text-brand shrink-0"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
                  </svg>
                </div>
                <p className="text-[9px] text-white/35">Sabrina Carpenter &middot; 30m</p>
              </div>
              <div className="w-6 h-6 rounded-full border-2 border-white/15 flex items-center justify-center shrink-0">
                <span className="text-[6px] text-white/30 font-medium">0/3</span>
              </div>
            </div>
          </div>

          {/* Bottom nav */}
          <div className="absolute bottom-3 left-3 right-3">
            <div className="flex justify-around items-center py-2.5 rounded-2xl bg-black/70 backdrop-blur-sm border border-white/[0.06]">
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

      {/* Glow — boosted */}
      <div className="absolute -inset-16 -z-10 bg-brand/12 rounded-full blur-3xl" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Spotify brand icon                                                 */
/* ------------------------------------------------------------------ */

function SpotifyIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card with scroll-triggered animation                       */
/* ------------------------------------------------------------------ */

const FEATURES = [
  {
    image: '/images/landing/concert.jpg',
    title: 'Friends drop songs in',
    desc: 'Your crew adds tracks to a shared inbox. Everyone contributes, everyone discovers.',
    iconType: 'audio' as const,
  },
  {
    image: '/images/landing/friends.jpg',
    title: 'React to every pick',
    desc: 'Swipe to react, drop emoji, see what everyone thinks. Every track gets its moment.',
    iconType: 'flame' as const,
  },
  {
    image: '/images/landing/hero-dj.jpg',
    title: 'Queue clears itself',
    desc: 'Once everyone listens, tracks auto-archive. No stale playlists, always fresh.',
    iconType: 'hand' as const,
  },
];

function FeatureCard({
  image,
  title,
  desc,
  iconType,
  index,
}: {
  image: string;
  title: string;
  desc: string;
  iconType: 'audio' | 'flame' | 'hand';
  index: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-60px' });
  const iconRef = useRef<AudioLinesIconHandle | FlameIconHandle | HandMetalIconHandle>(null);

  // Trigger icon animation when card comes into view
  useEffect(() => {
    if (isInView) {
      const timer = setTimeout(() => iconRef.current?.startAnimation(), 400 + index * 200);
      return () => clearTimeout(timer);
    }
  }, [isInView, index]);

  const IconComponent =
    iconType === 'audio' ? AudioLinesIcon : iconType === 'flame' ? FlameIcon : HandMetalIcon;

  return (
    <m.div
      ref={ref}
      initial={{ opacity: 0, y: 50 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ ...springs.gentle, delay: index * 0.15 }}
      className="rounded-2xl overflow-hidden glass group"
    >
      <div className="relative h-44 sm:h-52 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#0a0a0a]" />
      </div>
      <div className="p-5 -mt-8 relative">
        <div className="w-10 h-10 rounded-full bg-brand/15 border border-brand/20 flex items-center justify-center mb-3">
          <IconComponent ref={iconRef} size={20} className="text-brand" />
        </div>
        <h3 className="font-heading text-xl font-bold text-white mb-2">{title}</h3>
        <p className="text-sm text-white/50 leading-relaxed">{desc}</p>
      </div>
    </m.div>
  );
}

function FeatureCards({ onGetStarted }: { onGetStarted: () => void }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: '-100px' });

  return (
    <section ref={sectionRef} className="relative px-5 py-20 sm:py-28">
      {/* Subtle aurora background */}
      <div className="absolute inset-0 aurora-accent opacity-50" />

      <div className="relative max-w-5xl mx-auto">
        {/* Section header */}
        <m.div
          className="text-center mb-12 sm:mb-16"
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...springs.gentle }}
        >
          <h2 className="font-heading text-3xl sm:text-4xl font-bold text-white mb-3">
            How it works
          </h2>
          <p className="text-white/40 text-lg max-w-md mx-auto">
            Three steps to never-stale playlists
          </p>
        </m.div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {FEATURES.map((f, i) => (
            <FeatureCard key={i} {...f} index={i} />
          ))}
        </div>

        {/* Bottom CTA */}
        <m.div
          className="text-center mt-16 sm:mt-20"
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ ...springs.gentle, delay: 0.6 }}
        >
          <p className="font-display text-2xl sm:text-3xl text-white/60 mb-6">
            Your friends are waiting.
          </p>
          <button
            onClick={onGetStarted}
            className="btn-pill text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4 relative overflow-hidden bg-accent-green text-black hover:bg-accent-green/90 active:scale-[0.98] hover:scale-[1.02] transition-transform font-heading glow-green btn-shimmer"
          >
            <SpotifyIcon />
            Get Started Free
          </button>
        </m.div>
      </div>
    </section>
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
      {/* ───────── Hero — full viewport, content at bottom ───────── */}
      <section className="relative min-h-dvh flex flex-col justify-end overflow-clip">
        {/* Video background */}
        <HeroVideoBackground />

        {/* Overlay — lighter at top to let video breathe, darker at bottom for text */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#081420]/30 via-[#081420]/40 to-[#0a0a0a]/95" />

        {/* Color glow layer */}
        <div className="landing-glow" />

        {/* Content */}
        <div className="relative z-10 w-full">
          {/* Desktop: side-by-side layout */}
          <div className="max-w-6xl mx-auto w-full px-5 sm:px-8 pb-8 sm:pb-12">
            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between lg:gap-12">
              {/* Phone — visible on all sizes */}
              <div className="flex justify-center lg:order-2 lg:flex-shrink-0 mb-8 lg:mb-0">
                <div className="relative">
                  {/* Floating notification — one on mobile, all three on desktop */}
                  <m.div
                    className="absolute -top-3 -left-8 sm:-left-24 bg-[#141414] border border-white/10 rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 -rotate-2 shadow-2xl shadow-black/70 z-30 flex items-center gap-2 sm:gap-2.5 ring-1 ring-black/50"
                    initial={{ opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...springs.snappy, delay: 1.8 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/mockup/member-1.jpg"
                      alt=""
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <p className="text-[11px] sm:text-xs font-medium text-text-primary">
                        Sarah added a track
                      </p>
                      <p className="text-[10px] sm:text-[11px] text-text-tertiary">
                        Levitating &middot; Weekend Vibes
                      </p>
                    </div>
                  </m.div>

                  {/* Desktop-only: second notification */}
                  <m.div
                    className="absolute -bottom-4 -right-16 bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 rotate-2 shadow-2xl shadow-black/70 z-30 hidden lg:flex items-center gap-2.5 ring-1 ring-black/50"
                    initial={{ opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...springs.snappy, delay: 2.2 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/mockup/member-2.jpg"
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-text-primary">
                        Mike reacted <span className="text-[10px]">🔥</span> to your song
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        Blinding Lights &middot; just now
                      </p>
                    </div>
                  </m.div>

                  {/* Desktop-only: third notification */}
                  <m.div
                    className="absolute top-24 -right-10 bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 rotate-1 shadow-2xl shadow-black/70 z-30 hidden lg:flex items-center gap-2.5 ring-1 ring-black/50"
                    initial={{ opacity: 0, scale: 0.8, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...springs.snappy, delay: 2.6 }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/images/mockup/member-3.jpg"
                      alt=""
                      className="w-6 h-6 rounded-full object-cover shrink-0"
                    />
                    <div>
                      <p className="text-xs font-medium text-text-primary">
                        Jess joined your Swaplist
                      </p>
                      <p className="text-[11px] text-text-tertiary">
                        Weekend Vibes &middot; 5m ago
                      </p>
                    </div>
                  </m.div>

                  {/* Phone entrance — scale up + slight tilt on mobile */}
                  <m.div
                    initial={{ opacity: 0, scale: 0.85, y: 30 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ ...springs.gentle, delay: 0.4 }}
                    className="-rotate-3 lg:rotate-0"
                  >
                    <PhoneMockup />
                  </m.div>
                </div>
              </div>

              {/* Text content — anchored at bottom */}
              <div className="text-center lg:text-left lg:order-1 lg:pb-4">
                {/* Brand wordmark */}
                <m.span
                  className="font-display text-2xl sm:text-3xl text-gradient-brand tracking-[0.15em] uppercase block mb-5 lg:mb-6"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: 0.1 }}
                >
                  Swapify
                </m.span>

                {/* Headline — mixed typography */}
                <h1 className="mb-5 sm:mb-6 leading-[0.92]">
                  {[
                    {
                      text: 'A shared playlist',
                      className:
                        'font-heading text-[2.25rem] sm:text-5xl lg:text-6xl font-bold text-white',
                    },
                    {
                      text: 'that clears as you listen',
                      className:
                        'font-display text-[2.25rem] sm:text-5xl lg:text-6xl text-brand mt-1',
                    },
                  ].map((line, i) => (
                    <span key={i} className="block overflow-hidden py-[0.04em]">
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

                {/* Subtitle */}
                <m.p
                  className="text-lg sm:text-xl font-light text-white/55 max-w-sm mx-auto lg:mx-0 mb-8"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: 0.6 }}
                >
                  Think of it as a musical mailbox &mdash; friends fill it with songs, and listening
                  empties it.
                </m.p>

                {/* CTAs — big green pill + text sign in */}
                <m.div
                  className="flex flex-col sm:flex-row items-center gap-4 sm:gap-5 justify-center lg:justify-start"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: 0.8 }}
                >
                  <button
                    onClick={() => setShowGetStarted(true)}
                    className="btn-pill text-base sm:text-lg px-8 sm:px-10 py-3.5 sm:py-4 relative overflow-hidden bg-accent-green text-black hover:bg-accent-green/90 active:scale-[0.98] hover:scale-[1.02] transition-transform font-heading glow-green btn-shimmer"
                  >
                    <SpotifyIcon />
                    Get Started
                  </button>
                  <button
                    onClick={() => setShowSignIn(true)}
                    className="text-white/50 hover:text-white/80 underline underline-offset-4 decoration-white/20 hover:decoration-white/40 transition-all text-base font-medium"
                  >
                    Sign In
                  </button>
                </m.div>

                {/* How it works link */}
                <m.div
                  className="mt-6 flex justify-center lg:justify-start"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.2, duration: 0.5 }}
                >
                  <SpotifyChangesBanner />
                </m.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Feature cards ───────── */}
      <FeatureCards onGetStarted={() => setShowGetStarted(true)} />

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
            </a>
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
            <DialogTitle className="text-xl font-bold text-text-primary">Sign in</DialogTitle>
            <DialogDescription className="sr-only">
              Find your account and sign back in with Spotify
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-text-secondary">
              Enter your Spotify username or verified email to look up your account.
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
              {isSignInLooking ? 'Signing in...' : 'Sign in'}
            </button>
            {signInError && <p className="text-xs text-danger mt-2">{signInError}</p>}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
