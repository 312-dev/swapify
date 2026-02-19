"use client";

import { useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";

export default function JamSettingsPage() {
  const router = useRouter();
  const params = useParams();
  const jamId = params.jamId as string;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [archiveThreshold, setArchiveThreshold] = useState("none");
  const [maxTracksPerUser, setMaxTracksPerUser] = useState("");
  const [maxTrackAgeDays, setMaxTrackAgeDays] = useState(7);
  const [jamNameForKeepers, setJamNameForKeepers] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load current jam data
  useState(() => {
    fetch(`/api/jams/${jamId}`)
      .then((res) => res.json())
      .then((data) => {
        setName(data.name || "");
        setDescription(data.description || "");
        setImagePreview(data.imageUrl || null);
        setArchiveThreshold(data.archiveThreshold || "none");
        setMaxTracksPerUser(data.maxTracksPerUser?.toString() || "");
        setMaxTrackAgeDays(data.maxTrackAgeDays ?? 7);
        setJamNameForKeepers(data.name || "");
      });
  });

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Max 256KB for Spotify
    if (file.size > 256 * 1024) {
      setError("Image must be under 256KB for Spotify");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setIsSaving(true);
    setError(null);
    setSuccess(false);

    try {
      const body: Record<string, unknown> = {};
      if (name.trim()) body.name = name.trim();
      if (description !== undefined) body.description = description.trim();
      body.archiveThreshold = archiveThreshold;
      body.maxTracksPerUser =
        maxTracksPerUser.trim() === "" ? null : Number.parseInt(maxTracksPerUser, 10);
      body.maxTrackAgeDays = maxTrackAgeDays;

      // Handle image upload
      if (
        imagePreview &&
        imagePreview.startsWith("data:image/") &&
        fileInputRef.current?.files?.[0]
      ) {
        const base64 = imagePreview.split(",")[1];
        body.imageBase64 = base64;
      }

      const res = await fetch(`/api/jams/${jamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete() {
    if (
      !confirm(
        "Are you sure you want to delete this Deep Dig? This cannot be undone."
      )
    )
      return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/jams/${jamId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/dashboard");
      } else {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        setIsDeleting(false);
      }
    } catch {
      setError("Failed to delete");
      setIsDeleting(false);
    }
  }

  return (
    <div className="min-h-screen gradient-bg">
      <div className="max-w-md mx-auto px-5 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push(`/jam/${jamId}`)}
            className="text-text-secondary hover:text-text-primary transition-colors"
            data-tooltip="Back to dig"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-2xl font-bold text-text-primary">Settings</h1>
        </div>

        <form onSubmit={handleSave}>
          {/* Cover image section */}
          <div className="glass rounded-xl p-5">
            <label className="block text-sm font-medium text-text-secondary mb-2">
              Cover image
            </label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-xl bg-white/5 overflow-hidden flex-shrink-0">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Cover"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-spotify/20 to-spotify/5">
                    <span className="text-2xl">&#127851;</span>
                  </div>
                )}
              </div>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-pill btn-pill-secondary text-sm"
                >
                  Choose image
                </button>
                <p className="text-xs text-text-tertiary mt-1.5">
                  JPEG, max 256KB. Synced to Spotify.
                </p>
              </div>
            </div>
          </div>

          {/* Name & Description */}
          <div className="glass rounded-xl p-5 mt-4">
            <div className="mb-4">
              <label htmlFor="name" className="block text-sm font-medium text-text-secondary mb-2">
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-glass w-full"
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium text-text-secondary mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="input-glass w-full resize-none"
              />
            </div>
          </div>

          {/* Track limit */}
          <div className="glass rounded-xl p-5 mt-4">
            <label htmlFor="maxTracksPerUser" className="block text-sm font-medium text-text-secondary mb-2">
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
            <p className="text-xs text-text-tertiary mt-1.5">
              Limit how many active tracks each member can have. Leave blank for
              unlimited.
            </p>
          </div>

          {/* Auto-Archive */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-sm font-medium text-text-secondary mb-1">Auto-Archive</h2>
            <p className="text-xs text-text-tertiary mb-3">
              When a track is cleared, automatically save qualifying tracks to a
              Keepers playlist on Spotify.
            </p>
            <label htmlFor="archiveThreshold" className="block text-sm font-medium text-text-secondary mb-2">
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
            {archiveThreshold !== "none" && (
              <p className="text-xs text-text-tertiary mt-2">
                Tracks will be saved to &ldquo;{jamNameForKeepers} Keepers&rdquo; on Spotify.
              </p>
            )}
          </div>

          {/* Track Expiry */}
          <div className="glass rounded-xl p-5 mt-4">
            <h2 className="text-sm font-medium text-text-secondary mb-1">Track Expiry</h2>
            <p className="text-xs text-text-tertiary mb-3">
              Automatically remove tracks after a set number of days, once at
              least one member has listened. Set to 0 to disable.
            </p>
            <label htmlFor="maxTrackAgeDays" className="block text-sm font-medium text-text-secondary mb-2">
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
              <p className="text-xs text-text-tertiary mt-2">
                Tracks older than {maxTrackAgeDays} {maxTrackAgeDays === 1 ? "day" : "days"} will be auto-removed once at least one member has listened.
              </p>
            )}
            {maxTrackAgeDays === 0 && (
              <p className="text-xs text-text-tertiary mt-2">
                Track expiry is disabled. Tracks will only be removed when all members have listened.
              </p>
            )}
          </div>

          {/* Status messages */}
          {error && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger mt-4">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-spotify/10 border border-spotify/30 rounded-xl p-3 text-sm text-spotify mt-4">
              Settings saved!
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="btn-pill btn-pill-primary w-full mt-4 disabled:opacity-50"
          >
            {isSaving ? "Saving..." : "Save changes"}
          </button>
        </form>

        {/* Danger zone */}
        <div className="glass rounded-xl p-5 mt-8 border border-danger/20">
          <h2 className="text-sm font-medium text-danger mb-2">Danger zone</h2>
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn-pill text-danger border border-danger/30 hover:bg-danger/10 disabled:opacity-50"
          >
            {isDeleting ? "Deleting..." : "Delete this Deep Dig"}
          </button>
        </div>
      </div>
    </div>
  );
}
