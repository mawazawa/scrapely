import { getDb } from '@meridian/database';
import { $newsletter } from '@meridian/database';
import { z } from 'zod';

// Known disposable email domains
const DISPOSABLE_DOMAINS = new Set([
  'tempmail.com',
  'throwaway.email',
  '10minutemail.com',
  'guerrillamail.com',
  'mailinator.com',
  'temp-mail.org',
  'fakeinbox.com',
  'trashmail.com',
  'tempail.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
  'yopmail.com',
  'sharklasers.com',
  'mailnesia.com',
]);

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain);
}

export default defineEventHandler(async event => {
  // Parse the request body to get the email
  const body = await readBody(event);

  const bodyContent = z
    .object({
      email: z.string().email(),
    })
    .safeParse(body);
  if (bodyContent.success === false) {
    return sendError(
      event,
      createError({
        statusCode: 400,
        statusMessage: 'Invalid email format',
      })
    );
  }

  // Check for disposable email addresses
  if (isDisposableEmail(bodyContent.data.email)) {
    return sendError(
      event,
      createError({
        statusCode: 400,
        statusMessage: 'Disposable email addresses are not allowed',
      })
    );
  }

  try {
    // Insert email into the newsletter table
    await getDb(useRuntimeConfig(event).DATABASE_URL)
      .insert($newsletter)
      .values({ email: bodyContent.data.email })
      .onConflictDoNothing();

    return { success: true, message: 'Successfully subscribed' };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Database error:', errorMessage);
    return sendError(
      event,
      createError({
        statusCode: 500,
        statusMessage: 'Database error',
      })
    );
  }
});
