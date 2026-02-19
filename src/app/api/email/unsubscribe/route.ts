import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

// GET /api/email/unsubscribe?uid=<userId> — browser unsubscribe link
export async function GET(request: NextRequest) {
  const userId = request.nextUrl.searchParams.get('uid');
  if (!userId) {
    return new NextResponse('Invalid unsubscribe link', { status: 400 });
  }

  await db.update(users).set({ notifyEmail: false }).where(eq(users.id, userId));

  return new NextResponse(
    `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribed</title></head>
<body style="background:#0a0a0a;color:#ededed;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;text-align:center;padding:80px 20px;">
  <h1 style="color:#38BDF8;">Swapify</h1>
  <p>You have been unsubscribed from email notifications.</p>
  <p style="color:#666;margin-top:16px;">You can re-enable email notifications in your Swapify profile settings.</p>
</body></html>`,
    { headers: { 'Content-Type': 'text/html' } }
  );
}

// POST /api/email/unsubscribe — RFC 8058 one-click unsubscribe from email clients
export async function POST(request: NextRequest) {
  const userId =
    request.nextUrl.searchParams.get('uid') ??
    (await request
      .formData()
      .then((f) => f.get('List-Unsubscribe') as string | null)
      .catch(() => null));

  if (!userId) {
    return new NextResponse('Invalid', { status: 400 });
  }

  await db.update(users).set({ notifyEmail: false }).where(eq(users.id, userId));
  return new NextResponse('Unsubscribed', { status: 200 });
}
