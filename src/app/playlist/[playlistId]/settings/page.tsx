'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import {
  formatRemovalDelay,
  type RemovalDelay,
  SORT_MODE_LABELS,
  type SortMode,
} from '@/lib/utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function PlaylistSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.playlistId as string;

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [maxTracksPerUser, setMaxTracksPerUser] = useState('');
  const [maxTrackAgeDays, setMaxTrackAgeDays] = useState(7);
  const [removalDelay, setRemovalDelay] = useState('immediate');
  const [sortMode, setSortMode] = useState<SortMode>('order_added');

  // Load current playlist data
  useEffect(() => {
    fetch(`/api/playlists/${playlistId}`)
      .then((res) => res.json())
      .then((data) => {
        setMaxTracksPerUser(data.maxTracksPerUser?.toString() || '');
        setMaxTrackAgeDays(data.maxTrackAgeDays ?? 7);
        setRemovalDelay(data.removalDelay || 'immediate');
        setSortMode(data.sortMode || 'order_added');
      });
  }, [playlistId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);

    try {
      const body: Record<string, unknown> = {
        maxTracksPerUser:
          maxTracksPerUser.trim() === '' ? null : Number.parseInt(maxTracksPerUser, 10),
        maxTrackAgeDays,
        removalDelay,
        sortMode,
      };

      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      toast.success('Settings saved');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
        setIsDeleting(false);
        setShowDeleteDialog(false);
      }
    } catch {
      toast.error('Failed to delete');
      setIsDeleting(false);
      setShowDeleteDialog(false);
    }
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-md mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/playlist/${playlistId}`}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Back to playlist"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </Link>
          <h1 className="text-3xl font-bold text-text-primary">Settings</h1>
        </div>

        <form onSubmit={handleSave}>
          {/* Track limit */}
          <div className="glass rounded-xl p-5">
            <label
              htmlFor="maxTracksPerUser"
              className="block text-base font-medium text-text-secondary mb-2"
            >
              Max tracks per member
            </label>
            <input
              id="maxTracksPerUser"
              type="number"
              min="1"
              max="50"
              value={maxTracksPerUser}
              onChange={(e) => setMaxTracksPerUser(e.target.value)}
              placeholder="Unlimited"
              className="input-glass w-full"
            />
            <p className="text-sm text-text-tertiary mt-1.5">
              Limit how many active tracks each member can have. Leave blank for unlimited.
            </p>
          </div>

          {/* Track ordering */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-base font-medium text-text-secondary mb-1">Track ordering</h2>
            <p className="text-sm text-text-tertiary mb-3">
              Choose how tracks are ordered in this Swaplist.
            </p>
            <label
              htmlFor="sortMode"
              className="block text-base font-medium text-text-secondary mb-2"
            >
              Sort mode
            </label>
            <select
              id="sortMode"
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value as SortMode)}
              className="input-glass w-full"
            >
              {(Object.entries(SORT_MODE_LABELS) as [SortMode, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {sortMode === 'round_robin' && (
              <p className="text-sm text-text-tertiary mt-2">
                Alternates tracks between contributors for equal play time, ordered by when each
                person first added a track.
              </p>
            )}
            {(sortMode === 'energy_desc' || sortMode === 'energy_asc') && (
              <p className="text-sm text-text-tertiary mt-2">
                Sorts tracks by energy level using audio analysis. This may take a moment for large
                playlists.
              </p>
            )}
          </div>

          {/* Auto-refresh timer */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-base font-medium text-text-secondary mb-1">Auto-refresh timer</h2>
            <p className="text-sm text-text-tertiary mb-3">
              Remove tracks after a set number of days, no matter what. This keeps the playlist
              fresh even if not everyone is using the web app. Set to 0 to turn this off.
            </p>
            <label
              htmlFor="maxTrackAgeDays"
              className="block text-base font-medium text-text-secondary mb-2"
            >
              Days before auto-removal
            </label>
            <input
              id="maxTrackAgeDays"
              type="number"
              min={0}
              max={365}
              value={maxTrackAgeDays}
              onChange={(e) => setMaxTrackAgeDays(Number(e.target.value))}
              className="input-glass w-full"
            />
            {maxTrackAgeDays > 0 && (
              <p className="text-sm text-text-tertiary mt-2">
                Tracks will be removed after {maxTrackAgeDays}{' '}
                {maxTrackAgeDays === 1 ? 'day' : 'days'}, keeping the playlist fresh for everyone.
              </p>
            )}
            {maxTrackAgeDays === 0 && (
              <p className="text-sm text-text-tertiary mt-2">
                Auto-refresh is off. Tracks will only be removed once every web app member has
                listened or reacted.
              </p>
            )}
          </div>

          {/* Heard by everyone */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-base font-medium text-text-secondary mb-1">Heard by everyone</h2>
            <p className="text-sm text-text-tertiary mb-3">
              When every connected web app member has listened to or reacted to a track, how long
              should it stay before being removed?
            </p>
            <label
              htmlFor="removalDelay"
              className="block text-base font-medium text-text-secondary mb-2"
            >
              Keep for
            </label>
            <select
              id="removalDelay"
              value={removalDelay}
              onChange={(e) => setRemovalDelay(e.target.value)}
              className="input-glass w-full"
            >
              <option value="immediate">Remove immediately</option>
              <option value="1h">1 hour</option>
              <option value="12h">12 hours</option>
              <option value="24h">24 hours</option>
              <option value="3d">3 days</option>
              <option value="1w">1 week</option>
              <option value="1m">1 month</option>
            </select>
            {removalDelay !== 'immediate' && (
              <p className="text-sm text-text-tertiary mt-2">
                Tracks will stick around for{' '}
                {formatRemovalDelay(removalDelay as RemovalDelay).toLowerCase()} after everyone has
                heard them.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="btn-pill btn-pill-primary w-full mt-4 disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save changes'}
          </button>
        </form>

        {/* Danger zone */}
        <div className="glass rounded-xl p-5 mt-8 border border-danger/20">
          <h2 className="text-base font-medium text-danger mb-2">Danger zone</h2>
          <button
            onClick={() => setShowDeleteDialog(true)}
            className="btn-pill text-danger border border-danger/30 hover:bg-danger/10"
          >
            Delete this Swaplist
          </button>
        </div>
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="!bg-[#1a1a1a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this Swaplist?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the Swaplist and remove all tracks. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={handleDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
