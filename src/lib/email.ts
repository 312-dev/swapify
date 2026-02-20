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

function emailTemplate(
  title: string,
  body: string,
  url?: string,
  unsubUrl?: string | null,
  buttonLabel?: string
): string {
  const year = new Date().getFullYear();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://swapify.312.dev';
  const logoUrl = `${baseUrl}/icons/icon-192.png`;
  const fontUrl = `${baseUrl}/fonts/CalSans-SemiBold.woff2`;
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!--[if !mso]><!-->
  <style>
    @font-face {
      font-family: 'CalSans';
      src: url('${fontUrl}') format('woff2');
      font-weight: 600;
      font-style: normal;
      font-display: swap;
    }
    @import url('https://fonts.googleapis.com/css2?family=Epilogue:wght@400;500;600;700&display=swap');
  </style>
  <!--<![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#0f2847;font-family:'Epilogue',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;-webkit-font-smoothing:antialiased;">
  <div style="max-width:520px;margin:0 auto;padding:48px 20px;">

    <!-- Card -->
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.12);">

      <!-- Brand accent bar -->
      <div style="height:4px;background:#38BDF8;"></div>

      <!-- Logo header -->
      <div style="text-align:center;padding:32px 32px 24px;">
        <a href="${baseUrl}" style="text-decoration:none;display:inline-block;">
          <img src="${logoUrl}" alt="Swapify" width="40" height="40" style="display:inline-block;vertical-align:middle;border:0;border-radius:8px;" />
          <span style="font-family:'CalSans','Epilogue',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:24px;font-weight:600;color:#0f172a;vertical-align:middle;margin-left:12px;letter-spacing:-0.5px;">Swapify</span>
        </a>
      </div>

      <!-- Subtle divider -->
      <div style="height:1px;background:linear-gradient(90deg,transparent,#e2e8f0,transparent);margin:0 32px;"></div>

      <!-- Content -->
      <div style="padding:28px 32px 36px;">
        <h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#0f172a;line-height:1.3;">${title}</h2>
        <p style="margin:0 0 28px;color:#64748b;font-size:15px;line-height:1.7;">${body}</p>
        ${url ? `<div style="text-align:center;"><a href="${url}" style="display:inline-block;background:#38BDF8;color:#0f172a;padding:14px 36px;border-radius:999px;text-decoration:none;font-weight:600;font-size:14px;letter-spacing:0.3px;">${buttonLabel || 'View in Swapify'} &#8594;</a></div>` : ''}
      </div>

      <!-- Footer -->
      <div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 32px;text-align:center;">
        <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
          You're receiving this because you enabled notifications on Swapify.${unsubUrl ? `<br><a href="${unsubUrl}" style="color:#64748b;text-decoration:underline;">Unsubscribe</a>` : ''}
        </p>
      </div>

    </div>

    <!-- Bottom branding -->
    <p style="text-align:center;color:rgba(255,255,255,0.4);font-size:11px;margin:24px 0 0;letter-spacing:0.5px;">
      &copy; ${year} Swapify
    </p>

  </div>
</body>
</html>`;
}
