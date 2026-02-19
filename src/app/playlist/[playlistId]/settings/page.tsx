'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import Link from 'next/link';
import { formatRemovalDelay, type RemovalDelay } from '@/lib/utils';

export default function PlaylistSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.playlistId as string;

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [maxTracksPerUser, setMaxTracksPerUser] = useState('');
  const [maxTrackAgeDays, setMaxTrackAgeDays] = useState(7);
  const [removalDelay, setRemovalDelay] = useState('immediate');

  // Load current playlist data
  useEffect(() => {
    fetch(`/api/playlists/${playlistId}`)
      .then((res) => res.json())
      .then((data) => {
        setMaxTracksPerUser(data.maxTracksPerUser?.toString() || '');
        setMaxTrackAgeDays(data.maxTrackAgeDays ?? 7);
        setRemovalDelay(data.removalDelay || 'immediate');
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
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        toast.error(data.error || 'Failed to delete');
        setIsDeleting(false);
        setShowDeleteConfirm(false);
      }
    } catch {
      toast.error('Failed to delete');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
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
          {showDeleteConfirm && (
            <p className="text-sm text-text-secondary mb-3">Are you sure? This cannot be undone.</p>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="btn-pill text-danger border border-danger/30 hover:bg-danger/10 disabled:opacity-50"
            >
              {isDeleting
                ? 'Deleting...'
                : showDeleteConfirm
                  ? 'Yes, delete'
                  : 'Delete this Swaplist'}
            </button>
            {showDeleteConfirm && (
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="btn-pill btn-pill-secondary"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
