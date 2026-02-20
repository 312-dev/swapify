import type { NextRequest } from 'next/server';
import { db } from '@/db';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

function htmlResponse(title: string, message: string, success: boolean) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const icon = success ? '&#10003;' : '&#10007;';
  const iconColor = success ? '#4ADE80' : '#EF4444';

  return new Response(
    `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} — Swapify</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Epilogue',-apple-system,BlinkMacSystemFont,sans-serif;min-height:100dvh;display:flex;align-items:center;justify-content:center;">
  <div style="text-align:center;padding:32px 24px;max-width:400px;">
    <div style="width:64px;height:64px;border-radius:50%;background:${iconColor}22;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:32px;color:${iconColor};">${icon}</div>
    <h1 style="color:#fff;font-size:22px;margin:0 0 8px;">${title}</h1>
    <p style="color:#a0a0a0;font-size:14px;line-height:1.5;margin:0 0 24px;">${message}</p>
    <a href="${appUrl}/dashboard" style="display:inline-block;background:#38BDF8;color:#000;padding:12px 32px;border-radius:24px;text-decoration:none;font-weight:600;font-size:14px;">Open Swapify</a>
  </div>
</body></html>`,
    { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');

  if (!token) {
    return htmlResponse(
      'Invalid Link',
      'This verification link is invalid. Please request a new one from your profile.',
      false
    );
  }

  const user = await db.query.users.findFirst({
    where: eq(users.emailVerifyToken, token),
  });

  if (!user) {
    return htmlResponse(
      'Invalid Link',
      'This verification link is invalid or has already been used. Please request a new one from your profile.',
      false
    );
  }

  if (user.emailVerifyExpiresAt! < Date.now()) {
    return htmlResponse(
      'Link Expired',
      'This verification link has expired. Please request a new one from your profile.',
      false
    );
  }

  await db
    .update(users)
    .set({
      email: user.pendingEmail,
      pendingEmail: null,
      emailVerifyToken: null,
      emailVerifyExpiresAt: null,
    })
    .where(eq(users.id, user.id));

  return htmlResponse(
    'Email Verified!',
    'Your email has been confirmed. You can close this tab or open Swapify.',
    true
  );
}
