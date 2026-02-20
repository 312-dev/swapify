import { requireVerifiedEmail } from '@/lib/auth';
import ActivityClient from './ActivityClient';

export default async function ActivityPage() {
  await requireVerifiedEmail();
  return <ActivityClient />;
}
