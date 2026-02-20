'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { m } from 'motion/react';
import {
  ArrowLeft,
  Crown,
  Users,
  ExternalLink,
  ImagePlus,
  Pencil,
  UserPlus,
  Copy,
  Check,
  Trash2,
  Link2,
  LogOut,
} from 'lucide-react';
import { toast } from 'sonner';
import { compressImageForSpotify } from '@/lib/image-compress';
import { springs, STAGGER_DELAY } from '@/lib/motion';
import AddMemberWizard from '@/components/AddMemberWizard';
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

// ─── Types ──────────────────────────────────────────────────────────────────

interface CircleMember {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  role: string;
  joinedAt: string;
}

interface CircleData {
  id: string;
  name: string;
  imageUrl: string | null;
  spotifyClientId: string;
  inviteCode: string;
  maxMembers: number;
  members: CircleMember[];
}

interface CircleSettingsClientProps {
  circle: CircleData;
  isHost: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────────

export default function CircleSettingsClient({ circle, isHost }: CircleSettingsClientProps) {
  const router = useRouter();

  // Edit form state (host only)
  const [editName, setEditName] = useState(circle.name);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(circle.imageUrl);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Invite code copy state
  const [inviteCopied, setInviteCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  // Add member wizard
  const [showAddMember, setShowAddMember] = useState(false);

  // Remove member dialog
  const [removingMember, setRemovingMember] = useState<CircleMember | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  // Leave circle dialog
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  // Delete circle dialog
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Image handling ──

  async function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const dataUrl = await compressImageForSpotify(file);
      setEditImagePreview(dataUrl);
    } catch {
      toast.error('Image could not be compressed under 256KB');
    }
  }

  // ── Save circle edits ──

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    const trimmedName = editName.trim();
    if (!trimmedName) {
      toast.error('Circle name cannot be empty');
      return;
    }

    setIsSaving(true);

    try {
      const body: Record<string, unknown> = {};

      if (trimmedName !== circle.name) {
        body.name = trimmedName;
      }

      if (editImagePreview !== circle.imageUrl) {
        if (editImagePreview?.startsWith('data:image/')) {
          body.imageBase64 = editImagePreview.split(',')[1];
        } else if (!editImagePreview) {
          body.imageBase64 = null;
        }
      }

      if (Object.keys(body).length === 0) {
        toast.info('No changes to save');
        setIsSaving(false);
        return;
      }

      const res = await fetch(`/api/circles/${circle.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update circle');
      }

      toast.success('Circle updated');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to update circle');
    } finally {
      setIsSaving(false);
    }
  }

  // ── Copy helpers ──

  function handleCopyInviteCode() {
    navigator.clipboard.writeText(circle.inviteCode).then(() => {
      setInviteCopied(true);
      toast.success('Invite code copied');
      setTimeout(() => setInviteCopied(false), 2000);
    });
  }

  function handleCopyShareLink() {
    const link = `${window.location.origin}/circle/join?code=${circle.inviteCode}`;
    navigator.clipboard.writeText(link).then(() => {
      setLinkCopied(true);
      toast.success('Share link copied');
      setTimeout(() => setLinkCopied(false), 2000);
    });
  }

  // ── Remove member ──

  async function confirmRemoveMember() {
    if (!removingMember) return;
    setIsRemoving(true);
    try {
      const res = await fetch(`/api/circles/${circle.id}/members/${removingMember.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to remove member');
      }
      toast.success(`${removingMember.displayName} has been removed`);
      setRemovingMember(null);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove member');
    } finally {
      setIsRemoving(false);
    }
  }

  // ── Leave circle ──

  async function confirmLeave() {
    setIsLeaving(true);
    try {
      const res = await fetch(`/api/circles/${circle.id}/leave`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to leave circle');
      }
      toast.success(`You left ${circle.name}`);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to leave circle');
    } finally {
      setIsLeaving(false);
    }
  }

  // ── Delete circle ──

  async function confirmDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/circles/${circle.id}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to delete circle');
      }
      toast.success(`${circle.name} has been deleted`);
      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to delete circle');
    } finally {
      setIsDeleting(false);
    }
  }

  // ── Render ──

  return (
    <div className="min-h-screen gradient-bg safe-top safe-bottom">
      <div className="max-w-md mx-auto px-5 py-6">
        {/* ── Header ── */}
        <m.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={springs.gentle}
          className="flex items-center gap-3 mb-6"
        >
          <button
            onClick={() => router.push('/dashboard')}
            className="text-text-secondary hover:text-text-primary transition-colors"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold text-text-primary">Circle Settings</h1>
        </m.div>

        {/* ── Host: edit form / Member: read-only header ── */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY }}
        >
          {isHost ? (
            <form onSubmit={handleSave} className="space-y-5">
              {/* Photo + Name side by side */}
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-20 h-20 shrink-0 rounded-xl overflow-hidden group cursor-pointer"
                >
                  {editImagePreview ? (
                    <img
                      src={editImagePreview}
                      alt="Circle"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-white/5 border border-dashed border-white/20 rounded-xl gap-1">
                      <ImagePlus className="w-5 h-5 text-text-tertiary" />
                      <span className="text-[10px] text-text-tertiary">Add photo</span>
                    </div>
                  )}
                  {editImagePreview && (
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
                      <Pencil className="w-4 h-4 text-white" />
                      <span className="text-[10px] font-medium text-white">Change</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </button>

                <div className="flex-1 min-w-0 pt-1">
                  <label
                    htmlFor="circle-name"
                    className="block text-sm font-medium text-text-secondary mb-1.5"
                  >
                    Circle name
                  </label>
                  <input
                    id="circle-name"
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="My Circle"
                    className="input-glass w-full"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  isSaving ||
                  (editName.trim() === circle.name && editImagePreview === circle.imageUrl)
                }
                className="btn-pill btn-pill-primary w-full disabled:opacity-50 text-sm"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          ) : (
            /* Member: read-only circle header */
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl shrink-0 overflow-hidden">
                {circle.imageUrl ? (
                  <img src={circle.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-white/5 flex items-center justify-center">
                    <Users className="w-6 h-6 text-text-tertiary" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-lg font-semibold text-text-primary truncate">{circle.name}</p>
                <p className="text-xs text-text-secondary">
                  {circle.members.length} / {circle.maxMembers} members
                </p>
              </div>
            </div>
          )}
        </m.div>

        {/* ── Invite Code (host only) ── */}
        {isHost && (
          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: STAGGER_DELAY * 2 }}
            className="glass rounded-xl p-4 mt-6"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
                Invite Code
              </p>
              <span className="text-xs text-text-tertiary">
                {circle.members.length} / {circle.maxMembers} members
              </span>
            </div>
            <div className="flex items-center gap-2">
              <code className="text-lg font-mono font-bold text-text-primary tracking-widest flex-1 select-all">
                {circle.inviteCode}
              </code>
              <button
                type="button"
                onClick={handleCopyInviteCode}
                className="shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Copy invite code"
              >
                {inviteCopied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-text-tertiary" />
                )}
              </button>
            </div>
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
              <p className="text-xs text-text-tertiary truncate flex-1 select-all">
                {typeof window !== 'undefined' ? window.location.origin : ''}/circle/join?code=
                {circle.inviteCode}
              </p>
              <button
                type="button"
                onClick={handleCopyShareLink}
                className="shrink-0 p-2 rounded-lg hover:bg-white/10 transition-colors"
                aria-label="Copy share link"
              >
                {linkCopied ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Link2 className="w-4 h-4 text-text-tertiary" />
                )}
              </button>
            </div>
          </m.div>
        )}

        {/* ── Members list ── */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 3 }}
          className="mt-6 space-y-3"
        >
          <p className="text-xs font-medium text-text-secondary uppercase tracking-wider">
            Members
          </p>

          <div className="space-y-2">
            {circle.members.map((member, i) => {
              const isMemberHost = member.role === 'host';
              return (
                <m.div
                  key={member.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...springs.gentle, delay: STAGGER_DELAY * (i + 4) }}
                  className="glass rounded-xl px-3 py-2.5 flex items-center gap-3"
                >
                  {/* Avatar */}
                  <div className="w-8 h-8 rounded-full shrink-0 overflow-hidden">
                    {member.avatarUrl ? (
                      <img
                        src={member.avatarUrl}
                        alt={member.displayName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-white/10 flex items-center justify-center text-sm font-medium text-text-secondary">
                        {member.displayName[0]}
                      </div>
                    )}
                  </div>

                  {/* Name + role */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {member.displayName}
                    </p>
                    {isMemberHost && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-brand">
                        <Crown className="w-2.5 h-2.5" />
                        Host
                      </span>
                    )}
                  </div>

                  {/* Remove button (host only, not for the host member) */}
                  {isHost && !isMemberHost && (
                    <button
                      type="button"
                      onClick={() => setRemovingMember(member)}
                      className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                      aria-label={`Remove ${member.displayName}`}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-text-tertiary" />
                    </button>
                  )}
                </m.div>
              );
            })}
          </div>

          {/* Add member button (host only) */}
          {isHost &&
            (circle.members.length >= circle.maxMembers ? (
              <p className="text-xs text-amber-400 text-center py-1">
                Circle is at maximum capacity
              </p>
            ) : (
              <button
                type="button"
                onClick={() => setShowAddMember(true)}
                className="flex items-center justify-center gap-1.5 text-sm text-brand hover:text-brand-hover transition-colors py-1 w-full"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add a Member
              </button>
            ))}
        </m.div>

        {/* ── Spotify Developer Dashboard (host only) ── */}
        {isHost && (
          <m.a
            href={`https://developer.spotify.com/dashboard/${circle.spotifyClientId}/users`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...springs.gentle, delay: STAGGER_DELAY * 5 }}
            className="w-full glass rounded-xl p-3 flex items-center gap-3 active:scale-[0.98] transition-transform mt-6"
          >
            <ExternalLink className="w-4 h-4 text-text-tertiary shrink-0" />
            <span className="text-xs text-text-tertiary">Spotify Developer Dashboard</span>
          </m.a>
        )}

        {/* ── Destructive actions ── */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...springs.gentle, delay: STAGGER_DELAY * 6 }}
          className="mt-8 pt-6 border-t border-white/10"
        >
          {isHost ? (
            <button
              type="button"
              onClick={() => setShowDeleteDialog(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors py-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Circle
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowLeaveDialog(true)}
              className="w-full flex items-center justify-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors py-2"
            >
              <LogOut className="w-4 h-4" />
              Leave Circle
            </button>
          )}
        </m.div>
      </div>

      {/* ── Add Member Wizard ── */}
      <AddMemberWizard
        isOpen={showAddMember}
        onClose={() => setShowAddMember(false)}
        circleId={circle.id}
        spotifyClientId={circle.spotifyClientId}
        inviteCode={circle.inviteCode}
      />

      {/* ── Remove Member AlertDialog ── */}
      <AlertDialog
        open={!!removingMember}
        onOpenChange={(open) => !open && setRemovingMember(null)}
      >
        <AlertDialogContent className="!bg-[#1a1a1a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {removingMember?.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They&apos;ll lose access to all Swaplists in this circle. Remember to also remove
              their email from your Spotify Developer Dashboard.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmRemoveMember}
              disabled={isRemoving}
            >
              {isRemoving ? 'Removing...' : 'Remove'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Leave Circle AlertDialog ── */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent className="!bg-[#1a1a1a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Leave {circle.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              You&apos;ll lose access to all Swaplists in this circle. You can rejoin later with an
              invite code.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmLeave} disabled={isLeaving}>
              {isLeaving ? 'Leaving...' : 'Leave'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete Circle AlertDialog ── */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="!bg-[#1a1a1a] border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {circle.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the circle and remove all members. Swaplists created in
              this circle will also be removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={confirmDelete} disabled={isDeleting}>
              {isDeleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
