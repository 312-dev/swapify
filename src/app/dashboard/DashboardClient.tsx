'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ImagePlus, Pencil } from 'lucide-react';
import PlaylistCard from '@/components/PlaylistCard';
import GlassDrawer from '@/components/ui/glass-drawer';
import NotificationPrompt from '@/components/NotificationPrompt';
import CircleSwitcher from '@/components/CircleSwitcher';
import SpotifySetupWizard from '@/components/SpotifySetupWizard';

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

interface PlaylistData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  vibeName: string | null;
  memberCount: number;
  activeTrackCount: number;
  totalTrackCount: number;
  likedTrackCount: number;
  unplayedCount: number;
  members: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
}

interface DashboardClientProps {
  playlists: PlaylistData[];
  userName: string;
  notifyPush: boolean;
  circles: Array<{
    id: string;
    name: string;
    imageUrl: string | null;
    spotifyClientId: string;
    role: string;
    memberCount: number;
  }>;
  activeCircleId: string | null;
  activeCircleName: string | null;
  syncCircleId?: string | null;
}

const VIBE_PLACEHOLDERS: Array<{
  name: string;
  desc: string;
  vibeLine: string;
  emoji: string;
  gradient: [string, string];
}> = [
  {
    name: 'late night drives',
    desc: 'windows down, vibes up',
    vibeLine: 'moody R&B \u00b7 chill rap \u00b7 slow jams',
    emoji: '\ud83c\udf19',
    gradient: ['#1e1b4b', '#312e81'],
  },
  {
    name: 'UNHINGED BANGERS',
    desc: 'no skips, only chaos',
    vibeLine: 'hyperpop \u00b7 hard drops \u00b7 EDM',
    emoji: '\ud83d\udd25',
    gradient: ['#7f1d1d', '#dc2626'],
  },
  {
    name: 'main character energy',
    desc: 'the soundtrack to your villain arc',
    vibeLine: 'indie pop \u00b7 alt \u00b7 cinematic',
    emoji: '\u2728',
    gradient: ['#581c87', '#a855f7'],
  },
  {
    name: 'COZY GIRL AUTUMN',
    desc: 'candles lit, oversized hoodie on',
    vibeLine: 'soft folk \u00b7 acoustic \u00b7 bedroom pop',
    emoji: '\ud83c\udf42',
    gradient: ['#78350f', '#d97706'],
  },
  {
    name: 'gym arc',
    desc: 'PR or ER, no in between',
    vibeLine: 'trap \u00b7 drill \u00b7 rage beats',
    emoji: '\ud83d\udcaa',
    gradient: ['#14532d', '#22c55e'],
  },
  {
    name: 'TOUCH GRASS',
    desc: 'for when the group chat goes outside',
    vibeLine: 'feel-good \u00b7 summer hits \u00b7 throwbacks',
    emoji: '\ud83c\udf3b',
    gradient: ['#164e63', '#38bdf8'],
  },
];

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardClient({
  playlists,
  notifyPush,
  circles,
  activeCircleId,
  activeCircleName,
  syncCircleId,
}: DashboardClientProps) {
  const router = useRouter();

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

  const [showCreate, setShowCreate] = useState(false);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);

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
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to create Swaplist');
      }
      const playlist = await res.json();
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

  function handleCreateImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 256 * 1024) {
      toast.error('Image must be under 256KB for Spotify');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setCreateImagePreview(ev.target?.result as string);
    reader.readAsDataURL(file);
  }

  // No circles at all — user needs to create one
  if (circles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="px-5 pt-6 pb-4">
          <p className="text-base text-text-secondary">{getGreeting()},</p>
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
    <div className="min-h-screen flex flex-col">
      {/* Circle switcher — centered at top, Life360 style */}
      {circles.length > 0 && (
        <div className="pt-5 pb-2 flex justify-center">
          <CircleSwitcher
            circles={circles}
            activeCircleId={activeCircleId}
            activeCircleName={activeCircleName}
          />
        </div>
      )}

      {/* Header */}
      <header className="px-5 pt-2 pb-4 flex items-start justify-between">
        <div>
          <p className="text-base text-text-secondary">{getGreeting()},</p>
          <h1 className="text-3xl font-bold text-text-primary mt-1">Your Swaplists</h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-10 h-10 rounded-full bg-brand flex items-center justify-center"
          aria-label="Create a Swaplist"
        >
          <svg
            className="w-5 h-5 text-black"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* Playlist list */}
      {playlists.length === 0 ? (
        <div className="px-4 pt-2 pb-6">
          <div className="relative overflow-hidden">
            {/* Decorative placeholder cards */}
            <div className="space-y-2 opacity-40 saturate-0 pointer-events-none">
              {VIBE_PLACEHOLDERS.slice(0, 3).map((vibe, i) => (
                <div
                  key={vibe.name}
                  className="glass rounded-2xl p-3.5 w-full text-left"
                  style={i >= 1 ? { filter: `blur(${i * 1.5}px)` } : undefined}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className="w-14 h-14 shrink-0 rounded-lg overflow-hidden flex items-center justify-center text-2xl"
                      style={{
                        background: `linear-gradient(135deg, ${vibe.gradient[0]}, ${vibe.gradient[1]})`,
                      }}
                    >
                      {vibe.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[15px] font-semibold truncate text-text-primary leading-tight">
                        {vibe.name}
                      </p>
                      <p className="text-[12px] text-brand/80 italic truncate mt-0.5">
                        {vibe.vibeLine}
                      </p>
                      <p className="text-[13px] text-text-tertiary mt-0.5">{vibe.desc}</p>
                    </div>
                    <svg
                      className="w-4 h-4 text-text-tertiary/60 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="m9 18 6-6-6-6" />
                    </svg>
                  </div>
                </div>
              ))}
            </div>
            {/* Fade + blur overlay */}
            <div
              className="absolute inset-x-0 bottom-0 h-32 pointer-events-none backdrop-blur-sm"
              style={{
                background: 'linear-gradient(to bottom, transparent, var(--background))',
                WebkitMaskImage: 'linear-gradient(to bottom, transparent, black)',
                maskImage: 'linear-gradient(to bottom, transparent, black)',
              }}
            />
            {/* Action button — floating centered over the list */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div
                className="rounded-full px-5 py-4"
                style={{
                  background:
                    'radial-gradient(ellipse at center, var(--background) 30%, transparent 70%)',
                }}
              >
                <button onClick={() => setShowCreate(true)} className="btn-pill btn-pill-primary">
                  Create Swaplist
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          <NotificationPrompt notifyPush={notifyPush} />
          {playlists.map((playlist) => (
            <PlaylistCard key={playlist.id} playlist={playlist} />
          ))}
        </div>
      )}

      {/* Create Bottom Sheet */}
      <GlassDrawer
        isOpen={showCreate}
        onClose={() => {
          setShowCreate(false);
          resetCreateForm();
        }}
        title="Create a Swaplist"
        snapPoint="half"
      >
        <form onSubmit={handleCreate} className="space-y-5">
          {/* Cover photo + Name — side by side */}
          <div className="flex items-start gap-4">
            <button
              type="button"
              onClick={() => createFileInputRef.current?.click()}
              className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden group cursor-pointer"
            >
              {createImagePreview ? (
                <img src={createImagePreview} alt="Cover" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/20 rounded-xl gap-1">
                  <ImagePlus className="w-5 h-5 text-text-tertiary" />
                  <span className="text-[10px] text-text-tertiary">Add photo</span>
                </div>
              )}
              {createImagePreview && (
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                  <Pencil className="w-4 h-4 text-white" />
                  <span className="text-[10px] font-medium text-white">Change</span>
                </div>
              )}
              <input
                ref={createFileInputRef}
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleCreateImageSelect}
                className="hidden"
              />
            </button>

            <div className="flex-1 min-w-0 pt-1">
              <input
                id="create-name"
                type="text"
                value={createName}
                onChange={(e) => setCreateName(e.target.value)}
                placeholder="My Swaplist"
                className="input-glass w-full"
              />
              <p className="text-xs text-text-tertiary mt-1.5">
                Leave blank to auto-generate from member names
              </p>
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
      </GlassDrawer>
    </div>
  );
}
