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

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

  return new NextResponse(
    `<!DOCTYPE html>
<html><head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Unsubscribed &mdash; Swapify</title>
  <style>@import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700&display=swap');</style>
</head>
<body style="margin:0;padding:0;background-color:#0f2847;font-family:'Epilogue',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;min-height:100dvh;display:flex;align-items:center;justify-content:center;">
  <div style="max-width:520px;margin:0 auto;padding:48px 20px;">
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);">
      <div style="height:4px;background:#38BDF8;"></div>
      <div style="text-align:center;padding:32px 32px 24px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 512 512" style="display:inline-block;vertical-align:middle;"><g fill="#38BDF8" transform="translate(0,512) scale(0.1,-0.1)"><path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z"/></g></svg>
        <span style="font-size:22px;font-weight:700;color:#0f172a;vertical-align:middle;margin-left:10px;letter-spacing:-0.5px;">Swapify</span>
      </div>
      <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);margin:0 32px;"></div>
      <div style="padding:28px 32px 36px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:50%;background:#f0fdf4;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:28px;color:#4ADE80;">&#10003;</div>
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;">Unsubscribed</h2>
        <p style="margin:0 0 24px;color:#64748b;font-size:15px;line-height:1.7;">You've been unsubscribed from email notifications.</p>
        <p style="margin:0 0 28px;color:#94a3b8;font-size:13px;line-height:1.6;">You can re-enable notifications anytime from your profile settings.</p>
        <a href="${appUrl}/profile" style="display:inline-block;background:#38BDF8;color:#0f172a;padding:14px 36px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.3px;">Open Profile &#8594;</a>
      </div>
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:16px 32px;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;">&copy; ${new Date().getFullYear()} Swapify</p>
      </div>
    </div>
  </div>
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
