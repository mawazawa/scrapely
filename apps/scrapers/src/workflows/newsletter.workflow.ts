/**
 * Newsletter workflow for Meridian
 * Sends daily brief emails to subscribers
 */

import { $newsletter, $reports, desc, eq, isNull, or } from '@meridian/database';
import { WorkflowEntrypoint, WorkflowStep, WorkflowEvent, WorkflowStepConfig } from 'cloudflare:workers';
import { err, ok, ResultAsync } from 'neverthrow';
import { Env } from '../index';
import { getDb } from '../lib/utils';
import { sendEmail, generateBriefEmail } from '../lib/email';
import { logger } from '../lib/logger';

type Params = {
  /** Force send even if already sent today */
  force?: boolean;
  /** Specific report slug to send (defaults to latest) */
  reportSlug?: string;
};

const dbStepConfig: WorkflowStepConfig = {
  retries: { limit: 3, delay: '1 second', backoff: 'linear' },
  timeout: '10 seconds',
};

const emailStepConfig: WorkflowStepConfig = {
  retries: { limit: 2, delay: '5 seconds', backoff: 'exponential' },
  timeout: '30 seconds',
};

/**
 * Newsletter workflow that sends daily briefs to subscribers
 */
export class SendNewsletter extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const db = getDb(this.env);
    const { force = false, reportSlug } = event.payload || {};

    logger.workflow('newsletter', 'start', 'started', { force, reportSlug });

    // Step 1: Get the latest report (or specific report)
    const report = await step.do('get-report', dbStepConfig, async () => {
      if (reportSlug) {
        const reports = await db
          .select()
          .from($reports)
          .where(eq($reports.slug, reportSlug))
          .limit(1);
        return reports[0] || null;
      }

      // Get the most recent published report
      const reports = await db
        .select()
        .from($reports)
        .orderBy(desc($reports.createdAt))
        .limit(1);

      return reports[0] || null;
    });

    if (!report) {
      logger.warn('Newsletter: No report found to send');
      return { sent: 0, error: 'No report found' };
    }

    // Step 2: Get all active subscribers
    const subscribers = await step.do('get-subscribers', dbStepConfig, async () => {
      const subs = await db
        .select({
          id: $newsletter.id,
          email: $newsletter.email,
          lastSentAt: $newsletter.lastSentAt,
        })
        .from($newsletter)
        .where(
          or(
            isNull($newsletter.unsubscribedAt),
            eq($newsletter.unsubscribedAt, null as unknown as Date)
          )
        );

      // Filter out those who received this report already (unless force)
      if (!force) {
        const reportDate = new Date(report.createdAt);
        reportDate.setHours(0, 0, 0, 0);

        return subs.filter(sub => {
          if (!sub.lastSentAt) return true;
          const lastSent = new Date(sub.lastSentAt);
          lastSent.setHours(0, 0, 0, 0);
          return lastSent < reportDate;
        });
      }

      return subs;
    });

    if (subscribers.length === 0) {
      logger.info('Newsletter: No subscribers to send to');
      return { sent: 0, skipped: 'No eligible subscribers' };
    }

    logger.info('Newsletter: Sending to subscribers', { count: subscribers.length });

    // Step 3: Generate email content
    const emailContent = await step.do('generate-email', dbStepConfig, async () => {
      return generateBriefEmail({
        title: report.title,
        content: report.content,
        date: new Date(report.createdAt),
        slug: report.slug,
      });
    });

    // Step 4: Send emails in batches (rate limited)
    const BATCH_SIZE = 10;
    const BATCH_DELAY_MS = 1000; // 1 second between batches
    let sentCount = 0;
    let failedCount = 0;

    for (let i = 0; i < subscribers.length; i += BATCH_SIZE) {
      const batch = subscribers.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      await step.do(`send-batch-${batchNumber}`, emailStepConfig, async () => {
        const results = await Promise.allSettled(
          batch.map(async subscriber => {
            const result = await sendEmail(this.env, {
              to: subscriber.email,
              subject: `📰 ${report.title}`,
              html: emailContent.html,
              text: emailContent.text,
            });

            if (result.isOk()) {
              // Update last sent timestamp
              await db
                .update($newsletter)
                .set({ lastSentAt: new Date() })
                .where(eq($newsletter.id, subscriber.id));
              return { success: true, email: subscriber.email };
            } else {
              logger.error('Newsletter: Failed to send email', {
                email: subscriber.email,
                error: result.error.message,
              });
              return { success: false, email: subscriber.email, error: result.error.message };
            }
          })
        );

        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            sentCount++;
          } else {
            failedCount++;
          }
        }

        return { sent: sentCount, failed: failedCount };
      });

      // Add delay between batches to avoid rate limiting
      if (i + BATCH_SIZE < subscribers.length) {
        await step.sleep('batch-delay', BATCH_DELAY_MS);
      }
    }

    logger.workflow('newsletter', 'complete', 'completed', {
      sent: sentCount,
      failed: failedCount,
      report: report.slug,
    });

    return {
      sent: sentCount,
      failed: failedCount,
      reportSlug: report.slug,
    };
  }
}

/**
 * Start the newsletter workflow
 */
export async function startNewsletterWorkflow(env: Env, params?: Params) {
  const workflow = await ResultAsync.fromPromise(
    (env as Env & { SEND_NEWSLETTER?: { create: (options: { id: string; params?: Params }) => Promise<{ id: string }> } })
      .SEND_NEWSLETTER?.create({ id: crypto.randomUUID(), params }) ||
      Promise.reject(new Error('SEND_NEWSLETTER binding not configured')),
    e => (e instanceof Error ? e : new Error(String(e)))
  );

  if (workflow.isErr()) {
    return err(workflow.error);
  }
  return ok(workflow.value);
}
