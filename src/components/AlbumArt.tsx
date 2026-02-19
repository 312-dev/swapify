'use client';

import { useState } from 'react';

interface AlbumArtProps {
  src: string | null | undefined;
  alt: string;
  className?: string;
  iconSize?: string;
}

export default function AlbumArt({
  src,
  alt,
  className = 'w-10 h-10 rounded-lg',
  iconSize = 'w-5 h-5',
}: AlbumArtProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${className} bg-white/5 flex items-center justify-center shrink-0 overflow-hidden`}
      >
        <svg className={`${iconSize} text-text-tertiary`} fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
        </svg>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={`${className} object-cover shrink-0`}
      onError={() => setFailed(true)}
    />
  );
}
