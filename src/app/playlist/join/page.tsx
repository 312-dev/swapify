import type { Metadata } from 'next';
import { db } from '@/db';
import { playlists } from '@/db/schema';
import { sql } from 'drizzle-orm';
import JoinPlaylistClient from './JoinPlaylistClient';

interface Props {
  searchParams: Promise<{ code?: string; cid?: string }>;
}

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const { code } = await searchParams;

  if (!code) {
    return {
      title: 'Join a Swaplist',
      description: 'Enter an invite code to join a shared Swapify playlist.',
    };
  }

  try {
    const playlist = await db.query.playlists.findFirst({
      where: sql`lower(${playlists.inviteCode}) = ${code.trim().toLowerCase()}`,
      with: { owner: true, members: true },
    });

    if (playlist) {
      const memberCount = playlist.members.length;
      const title = `Join ${playlist.name} on Swapify`;
      const description = `${playlist.owner.displayName} invited you to a Swaplist with ${memberCount} member${memberCount !== 1 ? 's' : ''}. Tap to join and start swapping songs.`;

      return {
        title,
        description,
        openGraph: {
          title,
          description,
          type: 'website',
        },
        twitter: {
          card: 'summary_large_image',
          title,
          description,
        },
      };
    }
  } catch {
    // Fall through to default metadata
  }

  return {
    title: 'Join a Swaplist',
    description: 'Enter an invite code to join a shared Swapify playlist.',
  };
}

export default function JoinPlaylistPage() {
  return <JoinPlaylistClient />;
}
