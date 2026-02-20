'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { compressImageForSpotify } from '@/lib/image-compress';
import { extractColors, rgbaCss, darken } from '@/lib/color-extract';
import {
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Download,
  ChevronRight,
  ChevronLeft,
  Sunrise,
  Sun,
  Moon,
} from 'lucide-react';
import { PlusIcon } from '@/components/icons/PlusIcon';
import { m, AnimatePresence } from 'motion/react';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import PlaylistCard from '@/components/PlaylistCard';
import type { PlaylistData } from '@/components/PlaylistCard';
import ActivityFeed from '@/components/ActivityFeed';
import GlassDrawer from '@/components/ui/glass-drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import NotificationPrompt from '@/components/NotificationPrompt';
import CircleSwitcher from '@/components/CircleSwitcher';
import SpotifySetupWizard from '@/components/SpotifySetupWizard';
import AddMemberWizard from '@/components/AddMemberWizard';
import ReauthOverlay from '@/components/ReauthOverlay';
import SpotlightTour from '@/components/SpotlightTour';

function Spinner() {
  return (
    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

interface DashboardClientProps {
  playlists: (PlaylistData & { isMember: boolean })[];
  userName: string;
  spotifyId: string;
  notifyPush: boolean;
  circles: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    spotifyClientId: string;
    inviteCode: string;
    maxMembers: number;
    role: string;
    memberCount: number;
    members: Array<{
      id: string;
      displayName: string;
      avatarUrl: string | null;
      role: string;
      joinedAt: string;
    }>;
  }>;
  activeCircleId: string | null;
  activeCircleName: string | null;
  syncCircleId?: string | null;
  hasCompletedTour: boolean;
}

interface SpotifyPlaylistBrowseItem {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  trackCount: number;
  collaborative: boolean;
  isPublic: boolean;
  ownerId: string;
  ownerName: string;
  alreadyImported: boolean;
}

const VIBE_PLACEHOLDERS: Array<{
  name: string;
  desc: string;
  vibeLine: string;
  imageUrl: string;
  accent: string; // HSL accent color for vibe text & row tint
}> = [
  {
    name: 'late night drives',
    desc: 'windows down, vibes up',
    vibeLine: 'moody R&B \u00b7 chill rap \u00b7 slow jams',
    imageUrl:
      'https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=112&h=112&fit=crop&auto=format',
    accent: '270, 80%, 70%', // purple
  },
  {
    name: 'UNHINGED BANGERS',
    desc: 'no skips, only chaos',
    vibeLine: 'hyperpop \u00b7 hard drops \u00b7 EDM',
    imageUrl:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=112&h=112&fit=crop&auto=format',
    accent: '350, 85%, 65%', // hot pink
  },
  {
    name: 'main character energy',
    desc: 'the soundtrack to your villain arc',
    vibeLine: 'indie pop \u00b7 alt \u00b7 cinematic',
    imageUrl:
      'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=112&h=112&fit=crop&auto=format',
    accent: '30, 90%, 65%', // warm amber
  },
  {
    name: 'COZY GIRL AUTUMN',
    desc: 'candles lit, oversized hoodie on',
    vibeLine: 'soft folk \u00b7 acoustic \u00b7 bedroom pop',
    imageUrl:
      'https://images.unsplash.com/photo-1508193638397-1c4234db14d8?w=112&h=112&fit=crop&auto=format',
    accent: '145, 70%, 60%', // forest green
  },
  {
    name: 'gym arc',
    desc: 'PR or ER, no in between',
    vibeLine: 'trap \u00b7 drill \u00b7 rage beats',
    imageUrl:
      'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=112&h=112&fit=crop&auto=format',
    accent: '0, 85%, 65%', // red
  },
  {
    name: 'TOUCH GRASS',
    desc: 'for when the group chat goes outside',
    vibeLine: 'feel-good \u00b7 summer hits \u00b7 throwbacks',
    imageUrl:
      'https://images.unsplash.com/photo-1501854140801-50d01698950b?w=112&h=112&fit=crop&auto=format',
    accent: '55, 85%, 60%', // golden yellow
  },
];

function getGreeting(): { text: string; Icon: typeof Sunrise; color: string } {
  const hour = new Date().getHours();
  if (hour < 12) return { text: 'Good morning', Icon: Sunrise, color: 'text-orange-300' };
  if (hour < 18) return { text: 'Good afternoon', Icon: Sun, color: 'text-amber-400' };
  if (hour < 21) return { text: 'Good evening', Icon: Sun, color: 'text-orange-400' };
  return { text: 'Good evening', Icon: Moon, color: 'text-purple-400' };
}

export default function DashboardClient({
  playlists,
  userName,
  spotifyId,
  notifyPush,
  circles,
  activeCircleId,
  activeCircleName,
  syncCircleId,
  hasCompletedTour,
}: DashboardClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [greeting, setGreeting] = useState<{
    text: string;
    Icon: typeof Sunrise;
    color: string;
  } | null>(null);
  useEffect(() => {
    setGreeting(getGreeting());
  }, []);

  // Show error toasts from URL params (e.g. after failed circle join)
  useEffect(() => {
    const error = searchParams.get('error');
    if (error === 'own_circle') {
      toast.error("You're the host of this circle — you can't join your own circle.");
      router.replace('/dashboard', { scroll: false });
    }
  }, [searchParams, router]);

  // Persist auto-defaulted circle to session on mount
  useEffect(() => {
    if (syncCircleId) {
      fetch('/api/circles/switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleId: syncCircleId }),
      }).catch(() => {});
    }
  }, [syncCircleId]);

  // View mode — grid (3-col cards) or list (row cards), persisted in localStorage
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  useEffect(() => {
    const saved = localStorage.getItem('swapify_view_mode');
    if (saved === 'list' || saved === 'grid') setViewMode(saved);
  }, []);

  const [showCreate, setShowCreate] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);

  // Find the active circle for the create drawer
  const activeCircle = circles.find((c) => c.id === activeCircleId) ?? null;

  // Circle photo ambient tint — extract dominant colors from circle group photo
  const [circleTint, setCircleTint] = useState('');
  const circleImageUrl = activeCircle?.imageUrl ?? null;

  useEffect(() => {
    if (!circleImageUrl) {
      setCircleTint('');
      return;
    }
    let cancelled = false;

    extractColors(circleImageUrl).then((colors) => {
      if (cancelled || !colors) return;

      const darkPrimary = darken(colors.primary, 0.35);
      const darkSecondary = darken(colors.secondary, 0.25);

      setCircleTint(
        [
          `radial-gradient(ellipse 130% 55% at 50% -5%, ${rgbaCss(darkPrimary, 0.55)} 0%, transparent 70%)`,
          `radial-gradient(ellipse 90% 45% at 85% 15%, ${rgbaCss(darkSecondary, 0.25)} 0%, transparent 55%)`,
          `radial-gradient(ellipse 70% 35% at 15% 25%, ${rgbaCss(colors.primary, 0.15)} 0%, transparent 45%)`,
        ].join(', ')
      );
    });

    return () => {
      cancelled = true;
    };
  }, [circleImageUrl]);

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Tour state — show spotlight walkthrough for first-time users
  const [showTour, setShowTour] = useState(!hasCompletedTour);

  // Reauth state — blocks the entire app when Spotify token is permanently invalid
  const [needsReauth, setNeedsReauth] = useState(false);

  // Import flow state
  const [showImport, setShowImport] = useState(false);
  const [importStep, setImportStep] = useState<'browse' | 'confirm' | 'loading'>('browse');
  const [spotifyPlaylists, setSpotifyPlaylists] = useState<SpotifyPlaylistBrowseItem[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [playlistFilter, setPlaylistFilter] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState<SpotifyPlaylistBrowseItem | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Load Spotify playlists when import drawer opens
  useEffect(() => {
    if (showImport && spotifyPlaylists.length === 0 && !isLoadingPlaylists) {
      setIsLoadingPlaylists(true);
      fetch('/api/spotify/playlists')
        .then(async (res) => {
          const data = await res.json();
          if (data.needsReauth) {
            setNeedsReauth(true);
            setShowImport(false);
            return;
          }
          if (data.rateLimited) {
            toast.error(
              data.error || 'Spotify is a bit busy right now. Please try again in a minute.'
            );
            setShowImport(false);
            return;
          }
          if (!res.ok) {
            toast.error(data.error || 'Failed to load playlists');
            return;
          }
          setSpotifyPlaylists(data.playlists ?? []);
        })
        .catch(() => toast.error('Could not reach the server. Please check your connection.'))
        .finally(() => setIsLoadingPlaylists(false));
    }
  }, [showImport]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    try {
      const body: Record<string, unknown> = {
        name: createName.trim() || undefined,
        description: createDesc.trim() || undefined,
      };
      if (createImagePreview?.startsWith('data:image/')) {
        body.imageBase64 = createImagePreview.split(',')[1];
      }
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsReauth) {
          setNeedsReauth(true);
          setShowCreate(false);
          return;
        }
        throw new Error(data.error || 'Failed to create Swaplist');
      }
      const playlist = data;
      router.push(`/playlist/${playlist.id}?share=1`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setIsCreating(false);
    }
  }

  function resetCreateForm() {
    setCreateName('');
    setCreateDesc('');
    setCreateImagePreview(null);
    setIsCreating(false);
  }

  async function handleCreateImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressImageForSpotify(file);
      setCreateImagePreview(dataUrl);
    } catch {
      toast.error('Image could not be compressed under 256KB');
    }
  }

  function resetImportState() {
    setImportStep('browse');
    setPlaylistFilter('');
    setSelectedPlaylist(null);
    setIsImporting(false);
  }

  // Join a circle playlist the user hasn't joined yet
  const [joiningPlaylistId, setJoiningPlaylistId] = useState<string | null>(null);

  async function handleJoinCirclePlaylist(playlistId: string) {
    setJoiningPlaylistId(playlistId);
    try {
      const res = await fetch(`/api/playlists/${playlistId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ circleJoin: true }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsReauth) {
          setNeedsReauth(true);
          return;
        }
        throw new Error(data.error || 'Failed to join');
      }
      toast.success('Joined Swaplist!');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
    } finally {
      setJoiningPlaylistId(null);
    }
  }

  async function handleImport(mode: 'update' | 'duplicate') {
    if (!selectedPlaylist) return;
    setIsImporting(true);
    setImportStep('loading');
    try {
      const res = await fetch('/api/playlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          importSpotifyPlaylistId: selectedPlaylist.id,
          importMode: mode,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.needsReauth) {
          setNeedsReauth(true);
          setShowImport(false);
          return;
        }
        throw new Error(data.error || 'Failed to import playlist');
      }
      const playlist = data;
      router.push(`/playlist/${playlist.id}?share=1`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
      setImportStep('confirm');
      setIsImporting(false);
    }
  }

  const filteredPlaylists = spotifyPlaylists.filter((p) =>
    p.name.toLowerCase().includes(playlistFilter.toLowerCase())
  );

  // No circles at all — user needs to create one
  if (circles.length === 0) {
    return (
      <div className="min-h-screen relative gradient-bg">
        <header className="relative z-1 px-5 pt-6 pb-4">
          <p className="text-base text-text-secondary flex items-center gap-1.5">
            {greeting?.Icon && <greeting.Icon className={`w-4 h-4 ${greeting.color}`} />}
            {greeting?.text},
          </p>
          <h1 className="text-3xl font-bold text-text-primary mt-1">Welcome to Swapify</h1>
        </header>

        <div className="py-16 px-6 text-center">
          <svg
            className="w-16 h-16 text-text-tertiary mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
          </svg>
          <h2 className="text-xl font-semibold text-text-primary">Create Your Circle</h2>
          <p className="text-base text-text-secondary mt-2 mb-6">
            Connect your Spotify app to get started. You&apos;ll create a circle that friends can
            join.
          </p>
          <button onClick={() => setShowSetupWizard(true)} className="btn-pill btn-pill-primary">
            Get Started
          </button>
        </div>

        <SpotifySetupWizard isOpen={showSetupWizard} onClose={() => setShowSetupWizard(false)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen relative gradient-bg">
      {/* Full-bleed circle photo tint — overlays the default gradient when active */}
      {circleTint && (
        <div
          className="absolute top-0 sm:-top-20 bottom-0 left-1/2 w-screen -translate-x-1/2 pointer-events-none z-0"
          aria-hidden="true"
          style={{ backgroundImage: circleTint }}
        />
      )}

      {/* Reauth overlay — blocks the entire app when Spotify token is expired */}
      {needsReauth && (
        <ReauthOverlay
          spotifyClientId={activeCircle?.spotifyClientId}
          circleId={activeCircle?.id}
        />
      )}

      {/* Greeting */}
      <m.header
        className="relative z-1 px-5 pt-10 pb-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ ...springs.gentle, delay: 0.05 }}
      >
        <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
          {greeting?.Icon && <greeting.Icon className={`w-5 h-5 ${greeting.color}`} />}
          {greeting?.text}, {userName.split(' ')[0]}
        </h1>
      </m.header>

      {/* Activity feed — cross-circle, above circle switcher */}
      <ActivityFeed />

      {/* Circle switcher — centered at top, Life360 style */}
      {circles.length > 0 && (
        <m.div
          className="relative z-1 pt-2 pb-2 flex justify-center"
          data-tour="circle-switcher"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.1 }}
        >
          <CircleSwitcher
            circles={circles}
            activeCircleId={activeCircleId}
            activeCircleName={activeCircleName}
          />
        </m.div>
      )}

      {/* Playlist sections — horizontal carousels */}
      {playlists.length === 0 ? (
        <m.div
          className="relative z-1 px-4 pt-2 pb-6"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: 0.15 }}
        >
          <div className="relative overflow-hidden">
            {/* Decorative placeholder cards — horizontal scroll */}
            <div className="flex gap-3 overflow-x-auto scrollbar-none px-1 pb-2 opacity-40 pointer-events-none">
              {VIBE_PLACEHOLDERS.slice(0, 5).map((vibe, i) => (
                <div
                  key={vibe.name}
                  className="w-40 shrink-0 rounded-xl overflow-hidden relative"
                  style={{
                    ...(i >= 3 ? { filter: `blur(${(i - 2) * 2}px)` } : {}),
                  }}
                >
                  <div className="w-40 h-40 rounded-xl overflow-hidden">
                    <img src={vibe.imageUrl} alt="" className="w-full h-full object-cover" />
                  </div>
                  <p className="text-sm font-semibold truncate text-text-primary mt-2 leading-tight">
                    {vibe.name}
                  </p>
                  <p
                    className="text-xs italic truncate mt-0.5"
                    style={{ color: `hsl(${vibe.accent})` }}
                  >
                    {vibe.vibeLine}
                  </p>
                </div>
              ))}
            </div>
            {/* Fade overlay on right */}
            <div
              className="absolute inset-y-0 right-0 w-24 pointer-events-none"
              style={{
                background: 'linear-gradient(to right, transparent, var(--background))',
              }}
            />
            {/* Action buttons — floating centered over the list */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-full px-5 py-4 flex flex-col items-center gap-2.5"
                style={{
                  background:
                    'radial-gradient(ellipse at center, var(--background) 30%, transparent 70%)',
                }}
              >
                <button onClick={() => setShowCreate(true)} className="btn-pill btn-pill-primary">
                  <PlusIcon size={16} loopInterval={5000} className="text-black" />
                  Create Swaplist
                </button>
                <button
                  onClick={() => {
                    resetImportState();
                    setShowImport(true);
                  }}
                  className="btn-pill btn-pill-secondary"
                >
                  <Download className="w-4 h-4" />
                  Import Playlist
                </button>
              </div>
            </div>
          </div>
        </m.div>
      ) : (
        <div className="relative z-1 space-y-6">
          <NotificationPrompt notifyPush={notifyPush} />

          {/* Your Swaplists */}
          {playlists.some((p) => p.isMember) && (
            <m.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.gentle, delay: 0.15 }}
            >
              <div className="flex items-center justify-between px-5 mb-3">
                <h2 className="text-lg font-bold text-text-primary">Your Swaplists</h2>
                <div className="flex items-center gap-2">
                  {/* View mode segmented control */}
                  <div className="flex items-center rounded-lg bg-white/8 p-0.5">
                    <button
                      onClick={() => {
                        setViewMode('list');
                        localStorage.setItem('swapify_view_mode', 'list');
                      }}
                      className={`relative p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-white/15 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
                      aria-label="List view"
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      >
                        <line x1="1" y1="3" x2="15" y2="3" />
                        <line x1="1" y1="8" x2="15" y2="8" />
                        <line x1="1" y1="13" x2="15" y2="13" />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('grid');
                        localStorage.setItem('swapify_view_mode', 'grid');
                      }}
                      className={`relative p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-white/15 text-text-primary' : 'text-text-tertiary hover:text-text-secondary'}`}
                      aria-label="Grid view"
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="1" y="1" width="6" height="6" rx="1.5" />
                        <rect x="9" y="1" width="6" height="6" rx="1.5" />
                        <rect x="1" y="9" width="6" height="6" rx="1.5" />
                        <rect x="9" y="9" width="6" height="6" rx="1.5" />
                      </svg>
                    </button>
                  </div>
                  <button
                    onClick={() => {
                      resetImportState();
                      setShowImport(true);
                    }}
                    className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/15 transition-colors"
                    aria-label="Import from Spotify"
                  >
                    <Download className="w-4 h-4 text-text-secondary" />
                  </button>
                  <button
                    onClick={() => setShowCreate(true)}
                    className="w-8 h-8 rounded-full bg-brand flex items-center justify-center"
                    aria-label="Create a Swaplist"
                    data-tour="create-swaplist"
                  >
                    <Plus className="w-4 h-4 text-black" strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {viewMode === 'grid' ? (
                  <m.div
                    key="grid"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={springs.snappy}
                    className="grid grid-cols-3 gap-2.5 px-4 pb-2"
                  >
                    {playlists
                      .filter((p) => p.isMember)
                      .map((playlist, i) => (
                        <m.div
                          key={playlist.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...springs.gentle, delay: i * STAGGER_DELAY }}
                        >
                          <PlaylistCard playlist={playlist} variant="grid" />
                        </m.div>
                      ))}
                  </m.div>
                ) : (
                  <m.div
                    key="list"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={springs.snappy}
                    className="flex flex-col gap-2 px-4 pb-2"
                  >
                    {playlists
                      .filter((p) => p.isMember)
                      .map((playlist, i) => (
                        <m.div
                          key={playlist.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...springs.gentle, delay: i * STAGGER_DELAY }}
                        >
                          <PlaylistCard playlist={playlist} variant="list" />
                        </m.div>
                      ))}
                  </m.div>
                )}
              </AnimatePresence>
            </m.section>
          )}

          {/* Other Swaplists in this Circle */}
          {playlists.some((p) => !p.isMember) && (
            <m.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springs.gentle, delay: 0.25 }}
            >
              <div className="flex items-center justify-between px-5 mb-3">
                <h2 className="text-lg font-bold text-text-primary">Discover</h2>
              </div>

              <AnimatePresence mode="wait">
                {viewMode === 'grid' ? (
                  <m.div
                    key="discover-grid"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={springs.snappy}
                    className="grid grid-cols-3 gap-2.5 px-4 pb-2"
                  >
                    {playlists
                      .filter((p) => !p.isMember)
                      .map((playlist, i) => (
                        <m.div
                          key={playlist.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ ...springs.gentle, delay: i * STAGGER_DELAY }}
                        >
                          <PlaylistCard
                            playlist={playlist}
                            variant="grid"
                            onJoin={handleJoinCirclePlaylist}
                            joiningId={joiningPlaylistId}
                          />
                        </m.div>
                      ))}
                  </m.div>
                ) : (
                  <m.div
                    key="discover-list"
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.97 }}
                    transition={springs.snappy}
                    className="flex flex-col gap-2 px-4 pb-2"
                  >
                    {playlists
                      .filter((p) => !p.isMember)
                      .map((playlist, i) => (
                        <m.div
                          key={playlist.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ ...springs.gentle, delay: i * STAGGER_DELAY }}
                        >
                          <PlaylistCard
                            playlist={playlist}
                            variant="list"
                            onJoin={handleJoinCirclePlaylist}
                            joiningId={joiningPlaylistId}
                          />
                        </m.div>
                      ))}
                  </m.div>
                )}
              </AnimatePresence>
            </m.section>
          )}
        </div>
      )}

      {/* Create Swaplist Dialog */}
      <Dialog
        open={showCreate}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreate(false);
            resetCreateForm();
          }
        }}
      >
        <DialogContent className="bg-[var(--surface-elevated)] border-white/[0.08] backdrop-blur-2xl sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-text-primary">
              Create a Swaplist
            </DialogTitle>
            <DialogDescription className="sr-only">
              Create a new collaborative playlist
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-5">
            {/* Circle context — single row: name + avatars + add */}
            {activeCircle && (
              <div className="flex items-center gap-3">
                <p className="text-sm text-text-tertiary shrink-0">{activeCircle.name}</p>
                <div className="flex items-center -space-x-1.5 flex-1 min-w-0">
                  {activeCircle.members.map((member) => (
                    <div
                      key={member.id}
                      title={member.displayName}
                      className="w-7 h-7 rounded-full ring-2 ring-surface shrink-0 overflow-hidden"
                    >
                      {member.avatarUrl ? (
                        <img
                          src={member.avatarUrl}
                          alt={member.displayName}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-white/10 flex items-center justify-center text-xs font-medium text-text-secondary">
                          {member.displayName[0]}
                        </div>
                      )}
                    </div>
                  ))}
                  {activeCircle.role === 'host' &&
                    activeCircle.members.length < activeCircle.maxMembers && (
                      <button
                        type="button"
                        onClick={() => setShowAddMember(true)}
                        title="Add a member"
                        className="w-7 h-7 rounded-full ring-2 ring-surface shrink-0 bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5 text-text-tertiary" />
                      </button>
                    )}
                </div>
              </div>
            )}

            {/* Cover photo + Name — side by side */}
            <div className="flex items-start gap-4">
              <button
                type="button"
                onClick={() => createFileInputRef.current?.click()}
                className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden group cursor-pointer"
              >
                {createImagePreview ? (
                  <img
                    src={createImagePreview}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/20 rounded-xl gap-1">
                    <ImagePlus className="w-5 h-5 text-text-tertiary" />
                    <span className="text-xs text-text-tertiary">Add photo</span>
                  </div>
                )}
                {createImagePreview && (
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                    <Pencil className="w-4 h-4 text-white" />
                    <span className="text-xs font-medium text-white">Change</span>
                  </div>
                )}
                <input
                  ref={createFileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleCreateImageSelect}
                  className="hidden"
                />
              </button>

              <div className="flex-1 min-w-0">
                <label
                  htmlFor="create-name"
                  className="block text-sm font-medium text-text-secondary mb-1.5"
                >
                  Name
                </label>
                <input
                  id="create-name"
                  type="text"
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="My Swaplist"
                  className="input-glass w-full"
                  autoComplete="off"
                  enterKeyHint="next"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="create-desc"
                className="block text-sm font-medium text-text-secondary mb-1.5"
              >
                Description
              </label>
              <textarea
                id="create-desc"
                value={createDesc}
                onChange={(e) => setCreateDesc(e.target.value)}
                placeholder="What's this swaplist about?"
                rows={2}
                className="input-glass w-full resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={isCreating}
              className="btn-pill btn-pill-primary w-full disabled:opacity-50"
            >
              {isCreating ? (
                <>
                  <Spinner /> Creating...
                </>
              ) : (
                'Create Swaplist'
              )}
            </button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Import Bottom Sheet */}
      <GlassDrawer
        isOpen={showImport}
        onClose={() => {
          setShowImport(false);
          resetImportState();
        }}
        title="Import from Spotify"
        snapPoint="full"
      >
        {importStep === 'browse' && (
          <div className="flex flex-col">
            {/* Search bar */}
            <div className="sticky top-0 z-10 pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary pointer-events-none" />
                <input
                  type="search"
                  value={playlistFilter}
                  onChange={(e) => setPlaylistFilter(e.target.value)}
                  placeholder="Filter playlists..."
                  className="w-full input-glass backdrop-blur-xl"
                  style={{ paddingLeft: '2.5rem' }}
                  enterKeyHint="search"
                  autoComplete="off"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
            </div>

            {/* Playlist list */}
            {isLoadingPlaylists ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 animate-pulse">
                    <div className="w-12 h-12 rounded-lg bg-white/5" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-white/5 rounded w-3/4" />
                      <div className="h-3 bg-white/5 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredPlaylists.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-text-tertiary">
                  {playlistFilter ? 'No playlists match your search' : 'No playlists found'}
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredPlaylists.map((playlist) => (
                  <button
                    key={playlist.id}
                    onClick={async () => {
                      if (!playlist.alreadyImported) {
                        setSelectedPlaylist(playlist);
                        setImportStep('confirm');
                        // Fetch accurate details from Spotify
                        try {
                          const res = await fetch(`/api/spotify/playlists/${playlist.id}`);
                          if (res.ok) {
                            const details = await res.json();
                            setSelectedPlaylist((prev) =>
                              prev?.id === playlist.id
                                ? {
                                    ...prev,
                                    trackCount: details.trackCount,
                                    collaborative: details.collaborative,
                                  }
                                : prev
                            );
                          }
                        } catch {
                          // Keep browse-list values as fallback
                        }
                      }
                    }}
                    disabled={playlist.alreadyImported}
                    className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {/* Playlist cover */}
                    <div className="w-12 h-12 rounded-lg bg-white/5 overflow-hidden shrink-0">
                      {playlist.imageUrl ? (
                        <img
                          src={playlist.imageUrl}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <svg
                            className="w-5 h-5 text-text-tertiary"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                          </svg>
                        </div>
                      )}
                    </div>

                    {/* Playlist info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-base font-medium text-text-primary truncate">
                        {playlist.name}
                      </p>
                      <p className="text-xs text-text-tertiary">
                        {playlist.trackCount} {playlist.trackCount === 1 ? 'track' : 'tracks'}
                        {playlist.alreadyImported && (
                          <span className="ml-2 text-brand/70 text-xs font-medium">
                            Already a Swaplist
                          </span>
                        )}
                      </p>
                    </div>

                    {!playlist.alreadyImported && (
                      <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {importStep === 'confirm' && selectedPlaylist && (
          <div className="space-y-6">
            {/* Back button */}
            <button
              onClick={() => setImportStep('browse')}
              className="flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>

            {/* Selected playlist info */}
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-xl bg-white/5 overflow-hidden shrink-0">
                {selectedPlaylist.imageUrl ? (
                  <img
                    src={selectedPlaylist.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-text-tertiary"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
                    </svg>
                  </div>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-text-primary">{selectedPlaylist.name}</p>
                <p className="text-sm text-text-secondary">
                  {selectedPlaylist.trackCount}{' '}
                  {selectedPlaylist.trackCount === 1 ? 'track' : 'tracks'}
                </p>
              </div>
            </div>

            {/* Collaborative warning */}
            {selectedPlaylist.ownerId === spotifyId && !selectedPlaylist.collaborative && (
              <p className="text-xs text-yellow-200/80 leading-relaxed">
                This playlist isn&apos;t collaborative yet. Importing it will make it collaborative
                on Spotify so members can add and remove tracks.
              </p>
            )}

            {/* Action buttons */}
            <div className="space-y-3">
              {selectedPlaylist.ownerId === spotifyId && (
                <button
                  onClick={() => handleImport('update')}
                  disabled={isImporting}
                  className="btn-pill btn-pill-primary w-full disabled:opacity-50"
                >
                  Use this playlist
                </button>
              )}
              <button
                onClick={() => handleImport('duplicate')}
                disabled={isImporting}
                className={`btn-pill w-full disabled:opacity-50 ${
                  selectedPlaylist.ownerId === spotifyId ? 'btn-pill-secondary' : 'btn-pill-primary'
                }`}
              >
                Duplicate as new playlist
              </button>
              {selectedPlaylist.ownerId !== spotifyId && (
                <p className="text-xs text-text-tertiary text-center">
                  You don&apos;t own this playlist, so a copy will be created in your Spotify
                  account.
                </p>
              )}
            </div>
          </div>
        )}

        {importStep === 'loading' && (
          <div className="flex flex-col items-center justify-center py-16">
            <Spinner />
            <p className="text-text-secondary mt-4">
              {isImporting
                ? selectedPlaylist?.ownerId === spotifyId
                  ? 'Setting up your Swaplist...'
                  : 'Duplicating playlist...'
                : 'Preparing...'}
            </p>
          </div>
        )}
      </GlassDrawer>

      {/* Add Member Wizard overlay (from Create Swaplist) */}
      {activeCircle && (
        <AddMemberWizard
          isOpen={showAddMember}
          onClose={() => setShowAddMember(false)}
          circleId={activeCircle.id}
          spotifyClientId={activeCircle.spotifyClientId}
          inviteCode={activeCircle.inviteCode}
        />
      )}

      {/* Spotlight onboarding tour for first-time users */}
      {showTour && circles.length > 0 && <SpotlightTour onComplete={() => setShowTour(false)} />}
    </div>
  );
}
