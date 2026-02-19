'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { m } from 'motion/react';
import { Globe, Mail, Plus, UserPlus } from 'lucide-react';
import { AudioLinesIcon, type AudioLinesIconHandle } from '@/components/ui/audio-lines';
import { FlameIcon, type FlameIconHandle } from '@/components/ui/flame';
import { HandMetalIcon, type HandMetalIconHandle } from '@/components/ui/hand-metal';
import { springs } from '@/lib/motion';
import { useAlbumColors } from '@/hooks/useAlbumColors';
import GlassDrawer from '@/components/ui/glass-drawer';
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
const VIDEO_OPACITY = 0.45;

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
    <div className="relative mx-auto w-[272px] sm:w-[290px]">
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
            {/* Cover — Unsplash sunset beach (royalty-free) */}
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

      {/* Glow */}
      <div className="absolute -inset-16 -z-10 bg-brand/8 rounded-full blur-3xl" />
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
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const FEATURE_TITLES = ['Share the aux', 'Vibe check every track', "Your crew's mixtape"];
const ICON_ANIM_DURATION_MS = 1200;
const ICON_GAP_MS = 400;
const SEQUENCE_PAUSE_MS = 3000;

/** Feature tags with icons that animate one at a time in sequence. */
function FeatureTags() {
  const iconRefs = [
    useRef<AudioLinesIconHandle>(null),
    useRef<FlameIconHandle>(null),
    useRef<HandMetalIconHandle>(null),
  ];

  useEffect(() => {
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    function runSequence() {
      iconRefs.forEach((ref, i) => {
        // Start each icon with a staggered delay
        const startAt = i * (ICON_ANIM_DURATION_MS + ICON_GAP_MS);
        timeouts.push(
          setTimeout(() => ref.current?.startAnimation(), startAt),
          setTimeout(() => ref.current?.stopAnimation(), startAt + ICON_ANIM_DURATION_MS)
        );
      });

      // After the full sequence finishes, pause then repeat
      const totalDuration = iconRefs.length * (ICON_ANIM_DURATION_MS + ICON_GAP_MS);
      timeouts.push(setTimeout(runSequence, totalDuration + SEQUENCE_PAUSE_MS));
    }

    // Initial kick-off after page load animations settle
    timeouts.push(setTimeout(runSequence, 2200));

    return () => timeouts.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <m.div
      className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1.3, duration: 0.6 }}
    >
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <AudioLinesIcon ref={iconRefs[0]} size={16} className="text-brand" />
        <span>{FEATURE_TITLES[0]}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <FlameIcon ref={iconRefs[1]} size={16} className="text-brand" />
        <span>{FEATURE_TITLES[1]}</span>
      </div>
      <div className="flex items-center gap-2 text-sm text-text-secondary">
        <HandMetalIcon ref={iconRefs[2]} size={16} className="text-brand" />
        <span>{FEATURE_TITLES[2]}</span>
      </div>
    </m.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Landing page                                                       */
/* ------------------------------------------------------------------ */

export default function LandingClient() {
  const [showChooser, setShowChooser] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joinError, setJoinError] = useState('');
  const [isResolving, setIsResolving] = useState(false);

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
      // Valid code — redirect to join page with the code
      window.location.href = `/playlist/join?code=${encodeURIComponent(joinCode.trim())}`;
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setIsResolving(false);
    }
  }

  return (
    <div className="h-dvh overflow-x-hidden flex flex-col">
      {/* ───────── Banner ───────── */}
      <SpotifyChangesBanner />

      {/* ───────── Hero ───────── */}
      <section className="relative flex-1 flex items-center overflow-hidden">
        {/* Background */}
        <div className="absolute inset-0 gradient-bg-radial" />
        <div className="landing-glow" />

        {/* Video background — crossfades between 3 random clips */}
        <HeroVideoBackground />
        {/* Dark overlay for text contrast */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#081420]/70 via-[#081420]/50 to-[#0a0a0a]/90" />

        {/* Soft ambient blurs */}
        <div className="absolute top-[18%] left-[8%] w-32 h-32 rounded-full bg-brand/[0.04] blur-2xl" />
        <div className="absolute bottom-[20%] right-[5%] w-48 h-48 rounded-full bg-violet-500/[0.03] blur-3xl" />

        <div className="relative z-10 max-w-6xl mx-auto w-full px-6 pt-10 sm:pt-14 pb-12 flex flex-col">
          {/* Centered brand mark */}
          <m.div
            className="flex items-center justify-center gap-4 mb-12 lg:mb-14"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: 0.05 }}
          >
            {/* Share Song icon — Noun Project, Arctic Aurora brand color */}
            <svg
              width="48"
              height="48"
              viewBox="0 0 512 512"
              fill="currentColor"
              className="shrink-0 text-brand drop-shadow-[0_0_14px_rgba(56,189,248,0.35)]"
              aria-hidden="true"
            >
              <g transform="translate(0,512) scale(0.1,-0.1)">
                <path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z" />
              </g>
            </svg>
            <span className="text-4xl sm:text-5xl font-display text-text-primary tracking-tight">
              Swapify
            </span>
          </m.div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-12 items-center flex-1">
            {/* Left — copy */}
            <div>
              <h1 className="text-[2.75rem] sm:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[0.95]">
                {[
                  { text: 'A shared music inbox', className: '' },
                  { text: 'for you and your friends', className: 'text-brand' },
                ].map((line, i) => (
                  <span key={i} className="block overflow-hidden py-[0.05em]">
                    <m.span
                      className={`block ${line.className}`}
                      initial={{ y: '110%' }}
                      animate={{ y: '0%' }}
                      transition={{
                        type: 'spring',
                        stiffness: 70,
                        damping: 18,
                        delay: 0.3 + i * 0.25,
                      }}
                    >
                      {line.text}
                    </m.span>
                  </span>
                ))}
              </h1>

              <m.p
                className="text-lg text-text-secondary max-w-md mb-10"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: 0.9 }}
              >
                Add tracks for your crew. React as you listen. When everyone&apos;s heard a song, it
                disappears&nbsp;&mdash; making room for what&apos;s next.
              </m.p>

              <m.button
                onClick={() => setShowChooser(true)}
                className="btn-pill text-base px-8 py-3.5 shadow-lg shadow-[#1DB954]/25 inline-flex bg-[#1DB954] text-black hover:bg-[#1ed760] active:scale-[0.98] hover:scale-[1.02] font-(family-name:--font-montserrat)"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ ...springs.gentle, delay: 1.1 }}
              >
                <SpotifyIcon />
                Get Started
              </m.button>

              {/* Feature tags — icons animate sequentially */}
              <FeatureTags />
            </div>

            {/* Right — phone + floating UI elements */}
            <div className="flex justify-center lg:justify-end">
              <div className="relative">
                {/* Floating notification — "Sarah added a track" */}
                <m.div
                  className="absolute -top-4 -left-28 bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 -rotate-2 shadow-2xl shadow-black/70 z-30 hidden sm:flex items-center gap-2.5 ring-1 ring-black/50"
                  initial={{ opacity: 0, scale: 0.8, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ ...springs.snappy, delay: 2 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mockup/member-1.jpg"
                    alt=""
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                  />
                  <div>
                    <p className="text-[11px] font-medium text-text-primary">Sarah added a track</p>
                    <p className="text-[9px] text-text-tertiary">
                      Levitating &middot; Weekend Vibes
                    </p>
                  </div>
                </m.div>

                {/* Floating notification — "Mike reacted 🔥 to your song" */}
                <m.div
                  className="absolute -bottom-6 -right-20 bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 rotate-2 shadow-2xl shadow-black/70 z-30 hidden sm:flex items-center gap-2.5 ring-1 ring-black/50"
                  initial={{ opacity: 0, scale: 0.8, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ ...springs.snappy, delay: 2.4 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mockup/member-2.jpg"
                    alt=""
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                  />
                  <div>
                    <p className="text-[11px] font-medium text-text-primary">
                      Mike reacted <span className="text-[10px]">🔥</span> to your song
                    </p>
                    <p className="text-[9px] text-text-tertiary">
                      Blinding Lights &middot; just now
                    </p>
                  </div>
                </m.div>

                {/* Floating notification — "Jess joined your Swaplist" */}
                <m.div
                  className="absolute top-20 -right-12 bg-[#141414] border border-white/10 rounded-xl px-3.5 py-2.5 rotate-1 shadow-2xl shadow-black/70 z-30 hidden lg:flex items-center gap-2.5 ring-1 ring-black/50"
                  initial={{ opacity: 0, scale: 0.8, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ ...springs.snappy, delay: 2.8 }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/images/mockup/member-3.jpg"
                    alt=""
                    className="w-6 h-6 rounded-full object-cover shrink-0"
                  />
                  <div>
                    <p className="text-[11px] font-medium text-text-primary">
                      Jess joined your Swaplist
                    </p>
                    <p className="text-[9px] text-text-tertiary">Weekend Vibes &middot; 5m ago</p>
                  </div>
                </m.div>

                {/* Phone slides in from the right */}
                <m.div
                  initial={{ opacity: 0, x: 80 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 50,
                    damping: 16,
                    delay: 1.2,
                  }}
                >
                  <PhoneMockup />
                </m.div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────── Footer ───────── */}
      <footer className="border-t border-glass-border">
        <div className="max-w-5xl mx-auto px-5 py-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          {/* Left — copyright + company */}
          <p className="text-xs text-text-secondary/70">
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://312.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-text-primary transition-colors"
            >
              312.dev LLC
            </a>
          </p>

          {/* Right — icon links */}
          <div className="flex items-center gap-4">
            <a
              href="mailto:ope@312.dev"
              className="text-text-secondary/70 hover:text-text-primary transition-colors"
              aria-label="Email us"
              title="ope@312.dev"
            >
              <Mail className="w-4 h-4" />
            </a>
            <a
              href="https://312.dev"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-secondary/70 hover:text-text-primary transition-colors"
              aria-label="312.dev"
              title="312.dev"
            >
              <Globe className="w-4 h-4" />
            </a>
          </div>
        </div>

        {/* Attribution — subtle, separate row */}
        <div className="max-w-5xl mx-auto px-5 pb-5">
          <p className="text-[10px] text-text-tertiary">
            Built on Spotify. Icon &ldquo;Share Song&rdquo; by{' '}
            <a
              href="https://thenounproject.com/icon/share-song-7686374/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-text-secondary/60 transition-colors"
            >
              S. Belalcazar Lareo
            </a>{' '}
            &mdash;{' '}
            <a
              href="https://thenounproject.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-text-secondary/60 transition-colors"
            >
              Noun Project
            </a>
            . Videos by{' '}
            <a
              href="https://www.pexels.com"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-text-secondary/60 transition-colors"
            >
              Pexels
            </a>
          </p>
        </div>
      </footer>

      {/* Get Started chooser */}
      <GlassDrawer
        isOpen={showChooser}
        onClose={() => {
          setShowChooser(false);
          setJoinCode('');
          setJoinError('');
        }}
        title="Get Started"
        snapPoint="half"
      >
        <div className="space-y-4">
          {/* Host option */}
          <button
            onClick={() => {
              setShowChooser(false);
              setTimeout(() => setShowSetupWizard(true), 300);
            }}
            className="w-full glass rounded-xl p-5 text-left active:scale-[0.98] transition-transform group"
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
                  Create your own shared playlist inbox
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

          {/* Join option */}
          <div className="w-full glass rounded-xl p-5">
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
                  setJoinCode(e.target.value.toUpperCase());
                  setJoinError('');
                }}
                placeholder="Enter invite code"
                className="input-glass flex-1 text-sm"
                maxLength={10}
              />
              <button
                onClick={handleJoinSubmit}
                disabled={!joinCode.trim() || isResolving}
                className="btn-pill btn-pill-primary btn-pill-sm shrink-0 disabled:opacity-50"
              >
                {isResolving ? 'Finding...' : 'Join'}
              </button>
            </div>
            {joinError && <p className="text-xs text-danger mt-2">{joinError}</p>}
            <p className="text-xs text-text-tertiary mt-2">
              Or open the invite link your host sent you directly
            </p>
          </div>
        </div>
      </GlassDrawer>

      {/* Setup Wizard for hosts */}
      <SpotifySetupWizard isOpen={showSetupWizard} onClose={() => setShowSetupWizard(false)} />
    </div>
  );
}
