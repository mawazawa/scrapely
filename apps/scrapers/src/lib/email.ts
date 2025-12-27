/**
 * Email utility for Meridian newsletter
 * Supports multiple email providers (Resend, SendGrid)
 */

import { err, ok, Result, ResultAsync } from 'neverthrow';
import { Env } from '../index';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailResult {
  id: string;
  provider: string;
}

/**
 * Send email via Resend API
 */
async function sendWithResend(
  apiKey: string,
  options: EmailOptions
): Promise<Result<EmailResult, Error>> {
  const result = await ResultAsync.fromPromise(
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Meridian <briefs@news.iliane.xyz>',
        to: [options.to],
        subject: options.subject,
        html: options.html,
        text: options.text,
      }),
    }).then(async res => {
      if (!res.ok) {
        const error = await res.text();
        throw new Error(`Resend API error: ${res.status} - ${error}`);
      }
      return res.json() as Promise<{ id: string }>;
    }),
    e => (e instanceof Error ? e : new Error(String(e)))
  );

  if (result.isErr()) return err(result.error);
  return ok({ id: result.value.id, provider: 'resend' });
}

/**
 * Send email (with provider fallback)
 */
export async function sendEmail(
  env: Env,
  options: EmailOptions
): Promise<Result<EmailResult, Error>> {
  // Try Resend first if available
  if (env.RESEND_API_KEY) {
    return sendWithResend(env.RESEND_API_KEY, options);
  }

  return err(new Error('No email provider configured. Set RESEND_API_KEY.'));
}

/**
 * Generate newsletter email HTML
 */
export function generateBriefEmail(brief: {
  title: string;
  content: string;
  date: Date;
  slug: string;
}): { html: string; text: string } {
  const briefUrl = `https://news.iliane.xyz/briefs/${brief.slug}`;
  const unsubscribeUrl = `https://news.iliane.xyz/unsubscribe`;

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${brief.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 24px; margin-bottom: 8px; }
    .date { color: #666; font-size: 14px; margin-bottom: 24px; }
    .content { margin-bottom: 32px; }
    .cta { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; font-size: 12px; color: #666; }
    .footer a { color: #666; }
  </style>
</head>
<body>
  <h1>${brief.title}</h1>
  <p class="date">${brief.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>

  <div class="content">
    ${brief.content.substring(0, 1000)}...
  </div>

  <a href="${briefUrl}" class="cta">Read Full Brief</a>

  <div class="footer">
    <p>You're receiving this because you subscribed to Meridian intelligence briefs.</p>
    <p><a href="${unsubscribeUrl}">Unsubscribe</a> | <a href="https://news.iliane.xyz">Visit Meridian</a></p>
  </div>
</body>
</html>`;

  const text = `
${brief.title}
${brief.date.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${brief.content.substring(0, 1000)}...

Read the full brief: ${briefUrl}

---
Unsubscribe: ${unsubscribeUrl}
`;

  return { html, text };
}

/**
 * Generate welcome email for new subscribers
 */
export function generateWelcomeEmail(email: string): { html: string; text: string } {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Meridian</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 600px; margin: 0 auto; padding: 20px; }
    h1 { font-size: 24px; }
    .cta { display: inline-block; background: #1a1a1a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <h1>Welcome to Meridian</h1>

  <p>Thanks for subscribing! You'll receive daily intelligence briefs with:</p>

  <ul>
    <li>AI-analyzed news from 800+ sources</li>
    <li>Smart clustering of related stories</li>
    <li>Analysis beyond headlines</li>
  </ul>

  <p>Your first brief will arrive tomorrow morning.</p>

  <a href="https://news.iliane.xyz" class="cta">Explore Past Briefs</a>
</body>
</html>`;

  const text = `
Welcome to Meridian!

Thanks for subscribing! You'll receive daily intelligence briefs with:
- AI-analyzed news from 800+ sources
- Smart clustering of related stories
- Analysis beyond headlines

Your first brief will arrive tomorrow morning.

Explore past briefs: https://news.iliane.xyz
`;

  return { html, text };
}
