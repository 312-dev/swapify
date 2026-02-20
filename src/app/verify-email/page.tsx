import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import VerifyEmailClient from './VerifyEmailClient';

export default async function VerifyEmailPage() {
  const user = await requireAuth();
  if (user.email) redirect('/dashboard');

  return (
    <VerifyEmailClient
      displayName={user.displayName}
      avatarUrl={user.avatarUrl}
      pendingEmail={user.pendingEmail}
    />
  );
}
