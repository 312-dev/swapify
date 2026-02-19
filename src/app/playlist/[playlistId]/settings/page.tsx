'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { formatRemovalDelay, type RemovalDelay } from '@/lib/utils';

export default function PlaylistSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const playlistId = params.playlistId as string;

  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [archiveThreshold, setArchiveThreshold] = useState('none');
  const [maxTracksPerUser, setMaxTracksPerUser] = useState('');
  const [maxTrackAgeDays, setMaxTrackAgeDays] = useState(7);
  const [removalDelay, setRemovalDelay] = useState('immediate');
  const [playlistNameForKeepers, setPlaylistNameForKeepers] = useState('');

  // Load current playlist data
  useState(() => {
    fetch(`/api/playlists/${playlistId}`)
      .then((res) => res.json())
      .then((data) => {
        setArchiveThreshold(data.archiveThreshold || 'none');
        setMaxTracksPerUser(data.maxTracksPerUser?.toString() || '');
        setMaxTrackAgeDays(data.maxTrackAgeDays ?? 7);
        setRemovalDelay(data.removalDelay || 'immediate');
        setPlaylistNameForKeepers(data.name || '');
      });
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const body: Record<string, unknown> = {
        archiveThreshold,
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

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Are you sure you want to delete this Swaplist? This cannot be undone.')) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/playlists/${playlistId}`, { method: 'DELETE' });
      if (res.ok) {
        router.push('/dashboard');
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to delete');
        setIsDeleting(false);
      }
    } catch {
      setError('Failed to delete');
      setIsDeleting(false);
    }
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-md mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push(`/playlist/${playlistId}`)}
            className="text-text-secondary hover:text-text-primary transition-colors"
            data-tooltip="Back to playlist"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
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

          {/* Auto-Archive */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-base font-medium text-text-secondary mb-1">Auto-Archive</h2>
            <p className="text-sm text-text-tertiary mb-3">
              When a track is cleared, automatically save qualifying tracks to a Keepers playlist on
              Spotify.
            </p>
            <label
              htmlFor="archiveThreshold"
              className="block text-base font-medium text-text-secondary mb-2"
            >
              Threshold
            </label>
            <select
              id="archiveThreshold"
              value={archiveThreshold}
              onChange={(e) => setArchiveThreshold(e.target.value)}
              className="input-glass w-full"
            >
              <option value="none">Disabled</option>
              <option value="no_dislikes">No dislikes</option>
              <option value="at_least_one_like">At least one like</option>
              <option value="universally_liked">Universally liked</option>
            </select>
            {archiveThreshold !== 'none' && (
              <p className="text-sm text-text-tertiary mt-2">
                Tracks will be saved to &ldquo;{playlistNameForKeepers} Keepers&rdquo; on Spotify.
              </p>
            )}
          </div>

          {/* Track Expiry */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-base font-medium text-text-secondary mb-1">Track Expiry</h2>
            <p className="text-sm text-text-tertiary mb-3">
              Automatically remove tracks after a set number of days, once at least one member has
              listened. Set to 0 to disable.
            </p>
            <label
              htmlFor="maxTrackAgeDays"
              className="block text-base font-medium text-text-secondary mb-2"
            >
              Max age (days)
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
                Tracks older than {maxTrackAgeDays} {maxTrackAgeDays === 1 ? 'day' : 'days'} will be
                auto-removed once at least one member has listened.
              </p>
            )}
            {maxTrackAgeDays === 0 && (
              <p className="text-sm text-text-tertiary mt-2">
                Track expiry is disabled. Tracks will only be removed when all members have
                listened.
              </p>
            )}
          </div>

          {/* Removal Delay */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-base font-medium text-text-secondary mb-1">Removal Delay</h2>
            <p className="text-sm text-text-tertiary mb-3">
              How long after everyone has listened before a track is removed from the Swaplist.
            </p>
            <label
              htmlFor="removalDelay"
              className="block text-base font-medium text-text-secondary mb-2"
            >
              Delay
            </label>
            <select
              id="removalDelay"
              value={removalDelay}
              onChange={(e) => setRemovalDelay(e.target.value)}
              className="input-glass w-full"
            >
              <option value="immediate">Immediately</option>
              <option value="1h">1 hour</option>
              <option value="12h">12 hours</option>
              <option value="24h">24 hours</option>
              <option value="3d">3 days</option>
              <option value="1w">1 week</option>
              <option value="1m">1 month</option>
            </select>
            {removalDelay !== 'immediate' && (
              <p className="text-sm text-text-tertiary mt-2">
                Tracks will remain on the Swaplist for{' '}
                {formatRemovalDelay(removalDelay as RemovalDelay).toLowerCase()} after all members
                have listened.
              </p>
            )}
          </div>

          {/* Status messages */}
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-base text-danger mt-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-spotify/10 border border-spotify/30 rounded-xl p-3 text-base text-spotify mt-4">
              Settings saved!
            </div>
          )}

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
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn-pill text-danger border border-danger/30 hover:bg-danger/10 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete this Swaplist'}
          </button>
        </div>
      </div>
    </div>
  );
}
