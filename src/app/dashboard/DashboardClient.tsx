'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { ImagePlus, Pencil } from 'lucide-react';
import PlaylistCard from '@/components/PlaylistCard';
import GlassDrawer from '@/components/ui/glass-drawer';
import NotificationPrompt from '@/components/NotificationPrompt';

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
}

interface PlaylistPreview {
  id: string;
  name: string;
  description: string | null;
  owner: { displayName: string; avatarUrl: string | null };
  memberCount: number;
  members: Array<{ displayName: string; avatarUrl: string | null }>;
  inviteCode: string;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardClient({ playlists, notifyPush }: DashboardClientProps) {
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Create form state
  const [createName, setCreateName] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createImagePreview, setCreateImagePreview] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Join form state
  const [joinCode, setJoinCode] = useState('');
  const [joinPreview, setJoinPreview] = useState<PlaylistPreview | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [isJoining, setIsJoining] = useState(false);

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

  async function lookupCode(inviteCode: string) {
    setIsLooking(true);
    setJoinPreview(null);

    try {
      const res = await fetch(`/api/playlists/resolve?code=${encodeURIComponent(inviteCode)}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Invalid invite code');
      }
      const playlist = await res.json();
      setJoinPreview(playlist);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Invalid invite code');
    } finally {
      setIsLooking(false);
    }
  }

  async function handleJoin() {
    if (!joinPreview) return;
    setIsJoining(true);

    try {
      const res = await fetch(`/api/playlists/${joinPreview.id}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinPreview.inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to join');
      }

      router.push(`/playlist/${joinPreview.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to join');
      setIsJoining(false);
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

  function resetJoinForm() {
    setJoinCode('');
    setJoinPreview(null);
    setIsLooking(false);
    setIsJoining(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-start justify-between">
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
        <div className="py-16 px-6 text-center">
          <svg
            className="w-16 h-16 text-text-tertiary mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
          </svg>
          <h2 className="text-xl font-semibold text-text-primary">No Swaplists yet</h2>
          <p className="text-base text-text-secondary mt-2 mb-6">
            Create your first collaborative playlist or join one
          </p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => setShowCreate(true)} className="btn-pill btn-pill-primary">
              Create a Swaplist
            </button>
            <button onClick={() => setShowJoin(true)} className="btn-pill btn-pill-secondary">
              Join with code
            </button>
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

      {/* Join Bottom Sheet */}
      <GlassDrawer
        isOpen={showJoin}
        onClose={() => {
          setShowJoin(false);
          resetJoinForm();
        }}
        title="Join a Swaplist"
        snapPoint="half"
      >
        {!joinPreview ? (
          <div className="space-y-4">
            <div>
              <label
                htmlFor="join-code"
                className="block text-base font-medium text-text-secondary mb-2"
              >
                Invite code
              </label>
              <div className="flex gap-2">
                <input
                  id="join-code"
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  placeholder="Enter invite code"
                  className="input-glass flex-1"
                />
                <button
                  onClick={() => lookupCode(joinCode)}
                  disabled={!joinCode.trim() || isLooking}
                  className="btn-pill btn-pill-primary disabled:opacity-50"
                >
                  {isLooking ? (
                    <>
                      <Spinner /> Looking...
                    </>
                  ) : (
                    'Find'
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass rounded-xl p-5 text-center">
              <h3 className="text-xl font-semibold text-text-primary mb-1">{joinPreview.name}</h3>
              {joinPreview.description && (
                <p className="text-base text-text-secondary mb-3">{joinPreview.description}</p>
              )}
              <p className="text-base text-text-secondary mb-3">
                Created by {joinPreview.owner.displayName} &middot; {joinPreview.memberCount} member
                {joinPreview.memberCount !== 1 ? 's' : ''}
              </p>

              {/* Member avatars */}
              <div className="flex justify-center mb-4">
                <div className="avatar-stack flex">
                  {joinPreview.members.slice(0, 5).map((m, i) =>
                    m.avatarUrl ? (
                      <img
                        key={i}
                        src={m.avatarUrl}
                        alt={m.displayName}
                        className="w-8 h-8 rounded-full"
                        data-tooltip={m.displayName}
                      />
                    ) : (
                      <div
                        key={i}
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-sm text-text-secondary"
                        data-tooltip={m.displayName}
                      >
                        {m.displayName[0]}
                      </div>
                    )
                  )}
                </div>
              </div>

              <button
                onClick={handleJoin}
                disabled={isJoining}
                className="btn-pill btn-pill-primary w-full disabled:opacity-50"
              >
                {isJoining ? (
                  <>
                    <Spinner /> Joining...
                  </>
                ) : (
                  'Join this Swaplist'
                )}
              </button>
            </div>

            <button
              onClick={() => {
                setJoinPreview(null);
                setJoinCode('');
              }}
              className="text-base text-text-secondary hover:text-text-primary transition-colors"
            >
              Use a different code
            </button>
          </div>
        )}
      </GlassDrawer>
    </div>
  );
}
