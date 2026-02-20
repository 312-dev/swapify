import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import LandingClient from './LandingClient';

export const metadata: Metadata = {
  title: 'Swapify — Swap songs with friends',
  description:
    'A shared playlist that clears as you listen — friends drop songs in, you react, and the queue empties itself.',
  openGraph: {
    title: 'Swapify — Swap songs with friends',
    description:
      'A shared playlist that clears as you listen — friends drop songs in, you react, and the queue empties itself.',
  },
};

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return <LandingClient />;
}
