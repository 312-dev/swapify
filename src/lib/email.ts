import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  url?: string,
  userId?: string,
  buttonLabel?: string
): Promise<void> {
  if (!resend) {
    console.warn('[Swapify] Resend not configured, skipping email');
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://swapify.312.dev';
  const unsubUrl = userId ? `${baseUrl}/api/email/unsubscribe?uid=${userId}` : null;

  try {
    await resend.emails.send({
      from: 'Swapify <swapify@312.dev>',
      to,
      subject: `Swapify: ${subject}`,
      html: emailTemplate(subject, body, url, unsubUrl, buttonLabel),
      ...(unsubUrl
        ? {
            headers: {
              'List-Unsubscribe': `<${unsubUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }
        : {}),
    });
  } catch (error) {
    console.error('[Swapify] Email send failed:', error);
    throw error;
  }
}

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 512 512" style="display:inline-block;vertical-align:middle;"><g fill="#38BDF8" transform="translate(0,512) scale(0.1,-0.1)"><path d="M1483 5105 c-170 -46 -304 -181 -348 -350 -12 -47 -15 -123 -15 -372 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -244 -247 -244 -643 1 -891 254 -257 657 -258 907 -1 l48 48 872 -386 873 -387 2 -111 c1 -62 3 -123 5 -137 3 -23 -51 -54 -802 -471 l-805 -447 -3 304 c-3 341 -1 351 64 400 l37 29 217 5 217 5 37 29 c71 54 85 151 32 221 -46 59 -72 65 -293 65 -217 0 -285 -11 -375 -56 -71 -36 -159 -123 -197 -193 -56 -106 -61 -143 -61 -488 l0 -313 -47 23 c-100 50 -152 62 -273 62 -94 0 -128 -4 -185 -23 -109 -36 -193 -88 -271 -167 -247 -249 -244 -645 6 -896 315 -316 845 -219 1032 190 39 85 58 189 58 324 l1 112 886 491 886 491 61 -49 c221 -179 520 -194 759 -39 117 77 203 189 255 333 l26 73 4 383 3 382 193 0 c258 0 332 22 455 136 113 104 169 270 144 419 -33 195 -192 359 -382 395 -80 15 -286 12 -359 -5 -175 -41 -311 -175 -357 -350 -12 -47 -15 -123 -15 -372 l0 -313 -42 21 c-213 109 -468 84 -665 -65 -35 -26 -73 -61 -87 -78 l-23 -30 -644 285 c-354 156 -749 331 -877 388 l-234 104 6 35 c3 19 6 187 6 373 l0 337 183 0 c200 0 271 11 359 56 65 33 164 132 200 200 145 271 -6 610 -307 689 -77 20 -318 20 -392 0z"/></g></svg>`;

function emailTemplate(
  title: string,
  body: string,
  url?: string,
  unsubUrl?: string | null,
  buttonLabel?: string
): string {
  const year = new Date().getFullYear();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://swapify.312.dev';
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background-color:#081420;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:520px;margin:0 auto;padding:48px 20px;">

    <!-- Card -->
    <div style="background:#111c2e;border-radius:16px;overflow:hidden;border:1px solid rgba(56,189,248,0.15);">

      <!-- Brand accent bar -->
      <div style="height:3px;background:linear-gradient(90deg,#38BDF8,#7DD3FC,#38BDF8);"></div>

      <!-- Logo header -->
      <div style="text-align:center;padding:32px 32px 24px;">
        <a href="${baseUrl}" style="text-decoration:none;display:inline-block;">
          ${LOGO_SVG}
          <span style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;font-size:24px;font-weight:700;color:#e2e8f0;vertical-align:middle;margin-left:12px;letter-spacing:-0.5px;">Swapify</span>
        </a>
      </div>

      <!-- Subtle divider -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,rgba(56,189,248,0.2),transparent);margin:0 32px;"></div>

      <!-- Content -->
      <div style="padding:28px 32px 36px;">
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#e2e8f0;line-height:1.3;">${title}</h2>
        <p style="margin:0 0 28px;color:#94a3b8;font-size:15px;line-height:1.7;">${body}</p>
        ${url ? `<div style="text-align:center;"><a href="${url}" style="display:inline-block;background:#38BDF8;color:#0f172a;padding:14px 36px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.3px;">${buttonLabel || 'View in Swapify'} &#8594;</a></div>` : ''}
      </div>

      <!-- Footer -->
      <div style="background:rgba(0,0,0,0.2);border-top:1px solid rgba(255,255,255,0.06);padding:20px 32px;text-align:center;">
        <p style="margin:0;color:#64748b;font-size:12px;line-height:1.6;">
          You're receiving this because you enabled notifications on Swapify.${unsubUrl ? `<br><a href="${unsubUrl}" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a>` : ''}
        </p>
      </div>

    </div>

    <!-- Bottom branding -->
    <p style="text-align:center;color:rgba(255,255,255,0.3);font-size:11px;margin:24px 0 0;letter-spacing:0.5px;">
      &copy; ${year} Swapify
    </p>

  </div>
</body>
</html>`;
}
