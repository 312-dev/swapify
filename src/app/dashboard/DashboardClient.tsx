"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import JamCard from "@/components/JamCard";
import BottomSheet from "@/components/BottomSheet";

interface JamData {
  id: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  memberCount: number;
  activeTrackCount: number;
  members: Array<{
    id: string;
    displayName: string;
    avatarUrl: string | null;
  }>;
}

interface DashboardClientProps {
  jams: JamData[];
  userName: string;
}

interface JamPreview {
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
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function DashboardClient({ jams, userName }: DashboardClientProps) {
  const router = useRouter();

  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);

  // Create form state
  const [createName, setCreateName] = useState("");
  const [createDesc, setCreateDesc] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Join form state
  const [joinCode, setJoinCode] = useState("");
  const [joinPreview, setJoinPreview] = useState<JamPreview | null>(null);
  const [isLooking, setIsLooking] = useState(false);
  const [isJoining, setIsJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setIsCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/jams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createName.trim() || undefined,
          description: createDesc.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create Deep Dig");
      }
      const jam = await res.json();
      router.push(`/jam/${jam.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Something went wrong");
      setIsCreating(false);
    }
  }

  async function lookupCode(inviteCode: string) {
    setIsLooking(true);
    setJoinError(null);
    setJoinPreview(null);

    try {
      const res = await fetch(
        `/api/jams/resolve?code=${encodeURIComponent(inviteCode)}`
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Invalid invite code");
      }
      const jam = await res.json();
      setJoinPreview(jam);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Invalid invite code");
    } finally {
      setIsLooking(false);
    }
  }

  async function handleJoin() {
    if (!joinPreview) return;
    setIsJoining(true);
    setJoinError(null);

    try {
      const res = await fetch(`/api/jams/${joinPreview.id}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteCode: joinPreview.inviteCode }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to join");
      }

      router.push(`/jam/${joinPreview.id}`);
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Failed to join");
      setIsJoining(false);
    }
  }

  function resetCreateForm() {
    setCreateName("");
    setCreateDesc("");
    setCreateError(null);
    setIsCreating(false);
  }

  function resetJoinForm() {
    setJoinCode("");
    setJoinPreview(null);
    setJoinError(null);
    setIsLooking(false);
    setIsJoining(false);
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="px-5 pt-6 pb-4 flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary">
            {getGreeting()},
          </p>
          <h1 className="text-2xl font-bold text-text-primary mt-1">
            Your Deep Digs
          </h1>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="w-10 h-10 rounded-full bg-spotify flex items-center justify-center"
          aria-label="Create a Deep Dig"
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

      {/* Jam list */}
      {jams.length === 0 ? (
        <div className="py-16 px-6 text-center">
          <svg
            className="w-16 h-16 text-text-tertiary mx-auto mb-4"
            viewBox="0 0 24 24"
            fill="currentColor"
          >
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3h-6ZM10 19a2 2 0 1 1 0-4 2 2 0 0 1 0 4Z" />
          </svg>
          <h2 className="text-lg font-semibold text-text-primary">
            No Deep Digs yet
          </h2>
          <p className="text-sm text-text-secondary mt-2 mb-6">
            Create your first collaborative playlist or join one
          </p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => setShowCreate(true)}
              className="btn-pill btn-pill-primary"
            >
              Create a Deep Dig
            </button>
            <button
              onClick={() => setShowJoin(true)}
              className="btn-pill btn-pill-secondary"
            >
              Join with code
            </button>
          </div>
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {jams.map((jam) => (
            <JamCard key={jam.id} jam={jam} />
          ))}
        </div>
      )}

      {/* Create Bottom Sheet */}
      <BottomSheet
        isOpen={showCreate}
        onClose={() => { setShowCreate(false); resetCreateForm(); }}
        title="Create a Deep Dig"
        snapPoint="half"
      >
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label htmlFor="create-name" className="block text-sm font-medium text-text-secondary mb-2">Name</label>
            <input
              id="create-name"
              type="text"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              placeholder="My Deep Dig"
              className="input-glass w-full"
            />
            <p className="text-xs text-text-tertiary mt-1.5">Leave blank to auto-generate from member names</p>
          </div>
          <div>
            <label htmlFor="create-desc" className="block text-sm font-medium text-text-secondary mb-2">Description</label>
            <textarea
              id="create-desc"
              value={createDesc}
              onChange={(e) => setCreateDesc(e.target.value)}
              placeholder="What's this dig about?"
              rows={3}
              className="input-glass w-full resize-none"
            />
          </div>
          {createError && (
            <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">{createError}</div>
          )}
          <button type="submit" disabled={isCreating} className="btn-pill btn-pill-primary w-full disabled:opacity-50">
            {isCreating ? "Creating..." : "Create Deep Dig"}
          </button>
        </form>
      </BottomSheet>

      {/* Join Bottom Sheet */}
      <BottomSheet
        isOpen={showJoin}
        onClose={() => { setShowJoin(false); resetJoinForm(); }}
        title="Join a Deep Dig"
        snapPoint="half"
      >
        {!joinPreview ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="join-code" className="block text-sm font-medium text-text-secondary mb-2">Invite code</label>
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
                  {isLooking ? "Looking..." : "Find"}
                </button>
              </div>
            </div>
            {joinError && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">{joinError}</div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="glass rounded-xl p-5 text-center">
              <h3 className="text-lg font-semibold text-text-primary mb-1">{joinPreview.name}</h3>
              {joinPreview.description && (
                <p className="text-sm text-text-secondary mb-3">{joinPreview.description}</p>
              )}
              <p className="text-sm text-text-secondary mb-3">
                Created by {joinPreview.owner.displayName} &middot;{" "}
                {joinPreview.memberCount} member{joinPreview.memberCount !== 1 ? "s" : ""}
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
                        className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs text-text-secondary"
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
                {isJoining ? "Joining..." : "Join this Deep Dig"}
              </button>
            </div>

            {joinError && (
              <div className="bg-danger/10 border border-danger/30 rounded-xl p-3 text-sm text-danger">{joinError}</div>
            )}

            <button
              onClick={() => {
                setJoinPreview(null);
                setJoinCode("");
                setJoinError(null);
              }}
              className="text-sm text-text-secondary hover:text-text-primary transition-colors"
            >
              Use a different code
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  );
}
