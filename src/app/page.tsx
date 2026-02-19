import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import LandingClient from './LandingClient';

export default async function LandingPage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return <LandingClient />;
}
