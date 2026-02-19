'use client';

import { useState, useRef } from 'react';
import { Pencil } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface EditDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  name: string;
  description: string | null;
  imageUrl: string | null;
  onSaved: (data: { name: string; description: string; imageUrl: string | null }) => void;
}

export default function EditDetailsModal({
  open,
  onOpenChange,
  playlistId,
  name: initialName,
  description: initialDescription,
  imageUrl: initialImageUrl,
  onSaved,
}: EditDetailsModalProps) {
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription || '');
  const [imagePreview, setImagePreview] = useState<string | null>(initialImageUrl);
  const [hasNewImage, setHasNewImage] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset state when modal opens
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setName(initialName);
      setDescription(initialDescription || '');
      setImagePreview(initialImageUrl);
      setHasNewImage(false);
    }
    onOpenChange(nextOpen);
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 256 * 1024) {
      toast.error('Image must be under 256KB for Spotify');
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string);
      setHasNewImage(true);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim()) {
      toast.error('Name is required');
      return;
    }

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim(),
      };

      if (hasNewImage && imagePreview?.startsWith('data:image/')) {
        body.imageBase64 = imagePreview.split(',')[1];
      }

      const res = await fetch(`/api/playlists/${playlistId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to update');
      }

      toast.success('Details saved');
      onSaved({
        name: name.trim(),
        description: description.trim(),
        imageUrl: hasNewImage ? imagePreview : initialImageUrl,
      });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton
        className="bg-[var(--surface-elevated)] border-white/[0.08] backdrop-blur-2xl sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-text-primary">Edit details</DialogTitle>
          <DialogDescription className="sr-only">
            Update the name, description, and cover image for this Swaplist.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col sm:flex-row gap-5">
          {/* Cover image */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="relative w-40 h-40 rounded-xl overflow-hidden shrink-0 mx-auto sm:mx-0 group cursor-pointer"
          >
            {imagePreview ? (
              <img src={imagePreview} alt="Cover" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-brand/20 to-transparent">
                <svg className="w-12 h-12 text-brand/40" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
                </svg>
              </div>
            )}
            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5">
              <Pencil className="w-5 h-5 text-white" />
              <span className="text-sm font-medium text-white">Choose photo</span>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png"
              onChange={handleImageSelect}
              className="hidden"
            />
          </button>

          {/* Name & Description fields */}
          <div className="flex-1 flex flex-col gap-3">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              className="input-glass w-full"
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add a description"
              rows={4}
              className="input-glass w-full resize-none flex-1"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-1">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="btn-pill btn-pill-primary disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
