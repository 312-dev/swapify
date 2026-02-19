import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  url?: string
): Promise<void> {
  if (!resend) {
    console.warn('[Swapify] Resend not configured, skipping email');
    return;
  }

  try {
    await resend.emails.send({
      from: 'Swapify <notifications@swapify.app>',
      to,
      subject: `Swapify: ${subject}`,
      html: emailTemplate(subject, body, url),
    });
  } catch (error) {
    console.error('[Swapify] Email send failed:', error);
  }
}

function emailTemplate(title: string, body: string, url?: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:480px;margin:0 auto;padding:32px 16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:#1DB954;font-size:24px;font-weight:bold;">Swapify</span>
    </div>
    <div style="background:#181818;border-radius:12px;padding:24px;color:#ededed;">
      <h2 style="margin:0 0 8px;font-size:18px;color:#fff;">${title}</h2>
      <p style="margin:0 0 16px;color:#a0a0a0;font-size:14px;line-height:1.5;">${body}</p>
      ${url ? `<a href="${url}" style="display:inline-block;background:#1DB954;color:#000;padding:10px 24px;border-radius:24px;text-decoration:none;font-weight:600;font-size:14px;">View in Swapify</a>` : ''}
    </div>
    <p style="text-align:center;color:#666;font-size:12px;margin-top:16px;">
      You're receiving this because you enabled email notifications in Swapify.
    </p>
  </div>
</body>
</html>`;
}
