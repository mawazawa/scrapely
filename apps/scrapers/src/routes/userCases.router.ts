/**
 * User Cases Router
 * API endpoints for user case tracking and management
 */

import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { getDb } from '@meridian/database';
import {
  $cases,
  $caseTracking,
  $caseNotes,
  $courts,
  $rulings,
  $caseEvents,
} from '@meridian/database';
import { and, desc, eq, sql } from 'drizzle-orm';
import { logger } from '../lib/logger';
import { createTrackingService } from '../court/tracking';

/**
 * Environment bindings
 */
interface Env {
  DATABASE_URL: string;
  SECRET_KEY: string;
  COURT_TRACKING_QUEUE?: Queue<{ caseId: number; action: string }>;
}

/**
 * Request context with user
 */
interface Variables {
  userId: string;
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

/**
 * Validation schemas
 */
const AddCaseSchema = z.object({
  caseNumber: z.string().min(8).max(20),
  courtId: z.string().min(1).max(50),
  nickname: z.string().max(100).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
});

const UpdateTrackingSchema = z.object({
  nickname: z.string().max(100).optional(),
  priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
  alertsEnabled: z.boolean().optional(),
});

const AddNoteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10000),
  isPinned: z.boolean().optional(),
});

const UpdateNoteSchema = z.object({
  title: z.string().max(200).optional(),
  content: z.string().min(1).max(10000).optional(),
  isPinned: z.boolean().optional(),
});

/**
 * Auth middleware (placeholder - implement proper auth)
 */
app.use('*', async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  // In production, validate JWT and extract user ID
  const token = authHeader.slice(7);
  // For now, just use a placeholder user ID
  c.set('userId', 'user-' + token.slice(0, 8));

  await next();
});

/**
 * GET /cases - List user's tracked cases
 */
app.get('/cases', async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DATABASE_URL);

  const { limit, offset, priority, search } = c.req.query();

  try {
    let query = db
      .select({
        tracking: $caseTracking,
        case: $cases,
        court: $courts,
      })
      .from($caseTracking)
      .innerJoin($cases, eq($caseTracking.caseId, $cases.id))
      .innerJoin($courts, eq($cases.courtId, $courts.id))
      .where(eq($caseTracking.userId, userId));

    // Apply filters
    const conditions = [eq($caseTracking.userId, userId)];

    if (priority) {
      conditions.push(eq($caseTracking.priority, priority));
    }

    const results = await db
      .select({
        id: $caseTracking.id,
        caseId: $cases.id,
        caseNumber: $cases.caseNumber,
        title: $cases.title,
        caseType: $cases.caseType,
        status: $cases.status,
        courtName: $courts.name,
        courtId: $courts.id,
        nickname: $caseTracking.nickname,
        priority: $caseTracking.priority,
        alertsEnabled: $caseTracking.alertsEnabled,
        lastViewedAt: $caseTracking.lastViewedAt,
        trackedAt: $caseTracking.createdAt,
        lastUpdated: $cases.lastUpdated,
      })
      .from($caseTracking)
      .innerJoin($cases, eq($caseTracking.caseId, $cases.id))
      .innerJoin($courts, eq($cases.courtId, $courts.id))
      .where(and(...conditions))
      .orderBy(desc($caseTracking.createdAt))
      .limit(parseInt(limit || '50'))
      .offset(parseInt(offset || '0'));

    // Get total count
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from($caseTracking)
      .where(eq($caseTracking.userId, userId));

    return c.json({
      cases: results,
      total: count,
      limit: parseInt(limit || '50'),
      offset: parseInt(offset || '0'),
    });
  } catch (error) {
    logger.error('Failed to list cases', { userId, error: String(error) });
    return c.json({ error: 'Failed to retrieve cases' }, 500);
  }
});

/**
 * POST /cases - Track a new case
 */
app.post('/cases', zValidator('json', AddCaseSchema), async (c) => {
  const userId = c.get('userId');
  const db = getDb(c.env.DATABASE_URL);
  const body = c.req.valid('json');

  try {
    // Check if case is already tracked by this user
    const [existing] = await db
      .select()
      .from($caseTracking)
      .innerJoin($cases, eq($caseTracking.caseId, $cases.id))
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($cases.caseNumber, body.caseNumber),
          eq($cases.courtId, body.courtId)
        )
      );

    if (existing) {
      return c.json({ error: 'Case is already being tracked' }, 409);
    }

    // Check user's case limit (free tier: 5 cases)
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from($caseTracking)
      .where(eq($caseTracking.userId, userId));

    const MAX_CASES_FREE = 5;
    if (count >= MAX_CASES_FREE) {
      return c.json({
        error: 'Case limit reached',
        limit: MAX_CASES_FREE,
        message: 'Upgrade to Pro to track more cases',
      }, 403);
    }

    // Use tracking service to add case
    const trackingService = createTrackingService(db, c.env.COURT_TRACKING_QUEUE);
    const result = await trackingService.trackCase(
      userId,
      body.caseNumber,
      body.courtId,
      { nickname: body.nickname, priority: body.priority }
    );

    if (!result.success) {
      return c.json({ error: result.error }, 400);
    }

    logger.info('Case tracked', {
      userId,
      caseNumber: body.caseNumber,
      caseId: result.caseId,
    });

    return c.json({
      success: true,
      caseId: result.caseId,
      message: 'Case is now being tracked',
    }, 201);
  } catch (error) {
    logger.error('Failed to track case', { userId, body, error: String(error) });
    return c.json({ error: 'Failed to track case' }, 500);
  }
});

/**
 * GET /cases/:id - Get case details
 */
app.get('/cases/:id', async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const db = getDb(c.env.DATABASE_URL);

  try {
    // Get case with tracking info
    const [result] = await db
      .select({
        tracking: $caseTracking,
        case: $cases,
        court: $courts,
      })
      .from($caseTracking)
      .innerJoin($cases, eq($caseTracking.caseId, $cases.id))
      .innerJoin($courts, eq($cases.courtId, $courts.id))
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($cases.id, caseId)
        )
      );

    if (!result) {
      return c.json({ error: 'Case not found' }, 404);
    }

    // Get recent rulings
    const rulings = await db
      .select()
      .from($rulings)
      .where(eq($rulings.caseId, caseId))
      .orderBy(desc($rulings.rulingDate))
      .limit(10);

    // Get upcoming events
    const events = await db
      .select()
      .from($caseEvents)
      .where(eq($caseEvents.caseId, caseId))
      .orderBy(desc($caseEvents.eventDate))
      .limit(10);

    // Get notes
    const notes = await db
      .select()
      .from($caseNotes)
      .where(
        and(
          eq($caseNotes.userId, userId),
          eq($caseNotes.caseId, caseId)
        )
      )
      .orderBy(desc($caseNotes.isPinned), desc($caseNotes.createdAt));

    // Update last viewed
    await db
      .update($caseTracking)
      .set({ lastViewedAt: new Date() })
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($caseTracking.caseId, caseId)
        )
      );

    return c.json({
      ...result.case,
      court: result.court,
      tracking: {
        nickname: result.tracking.nickname,
        priority: result.tracking.priority,
        alertsEnabled: result.tracking.alertsEnabled,
        createdAt: result.tracking.createdAt,
      },
      rulings,
      events,
      notes,
    });
  } catch (error) {
    logger.error('Failed to get case', { userId, caseId, error: String(error) });
    return c.json({ error: 'Failed to retrieve case' }, 500);
  }
});

/**
 * PATCH /cases/:id - Update tracking settings
 */
app.patch('/cases/:id', zValidator('json', UpdateTrackingSchema), async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const db = getDb(c.env.DATABASE_URL);
  const body = c.req.valid('json');

  try {
    const result = await db
      .update($caseTracking)
      .set(body)
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($caseTracking.caseId, caseId)
        )
      )
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Case not found' }, 404);
    }

    return c.json({ success: true, tracking: result[0] });
  } catch (error) {
    logger.error('Failed to update tracking', { userId, caseId, error: String(error) });
    return c.json({ error: 'Failed to update tracking' }, 500);
  }
});

/**
 * DELETE /cases/:id - Stop tracking a case
 */
app.delete('/cases/:id', async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const db = getDb(c.env.DATABASE_URL);

  try {
    // Delete notes first
    await db
      .delete($caseNotes)
      .where(
        and(
          eq($caseNotes.userId, userId),
          eq($caseNotes.caseId, caseId)
        )
      );

    // Delete tracking
    const result = await db
      .delete($caseTracking)
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($caseTracking.caseId, caseId)
        )
      )
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Case not found' }, 404);
    }

    logger.info('Case untracked', { userId, caseId });

    return c.json({ success: true, message: 'Case tracking stopped' });
  } catch (error) {
    logger.error('Failed to untrack case', { userId, caseId, error: String(error) });
    return c.json({ error: 'Failed to stop tracking' }, 500);
  }
});

/**
 * POST /cases/:id/notes - Add a note
 */
app.post('/cases/:id/notes', zValidator('json', AddNoteSchema), async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const db = getDb(c.env.DATABASE_URL);
  const body = c.req.valid('json');

  try {
    // Verify user is tracking this case
    const [tracking] = await db
      .select()
      .from($caseTracking)
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($caseTracking.caseId, caseId)
        )
      );

    if (!tracking) {
      return c.json({ error: 'Case not found' }, 404);
    }

    const [note] = await db
      .insert($caseNotes)
      .values({
        userId,
        caseId,
        title: body.title,
        content: body.content,
        isPinned: body.isPinned || false,
      })
      .returning();

    return c.json({ success: true, note }, 201);
  } catch (error) {
    logger.error('Failed to add note', { userId, caseId, error: String(error) });
    return c.json({ error: 'Failed to add note' }, 500);
  }
});

/**
 * PATCH /cases/:id/notes/:noteId - Update a note
 */
app.patch('/cases/:id/notes/:noteId', zValidator('json', UpdateNoteSchema), async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const noteId = parseInt(c.req.param('noteId'));
  const db = getDb(c.env.DATABASE_URL);
  const body = c.req.valid('json');

  try {
    const [note] = await db
      .update($caseNotes)
      .set({
        ...body,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq($caseNotes.id, noteId),
          eq($caseNotes.userId, userId),
          eq($caseNotes.caseId, caseId)
        )
      )
      .returning();

    if (!note) {
      return c.json({ error: 'Note not found' }, 404);
    }

    return c.json({ success: true, note });
  } catch (error) {
    logger.error('Failed to update note', { userId, noteId, error: String(error) });
    return c.json({ error: 'Failed to update note' }, 500);
  }
});

/**
 * DELETE /cases/:id/notes/:noteId - Delete a note
 */
app.delete('/cases/:id/notes/:noteId', async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const noteId = parseInt(c.req.param('noteId'));
  const db = getDb(c.env.DATABASE_URL);

  try {
    const result = await db
      .delete($caseNotes)
      .where(
        and(
          eq($caseNotes.id, noteId),
          eq($caseNotes.userId, userId),
          eq($caseNotes.caseId, caseId)
        )
      )
      .returning();

    if (result.length === 0) {
      return c.json({ error: 'Note not found' }, 404);
    }

    return c.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    logger.error('Failed to delete note', { userId, noteId, error: String(error) });
    return c.json({ error: 'Failed to delete note' }, 500);
  }
});

/**
 * GET /cases/:id/timeline - Get case timeline
 */
app.get('/cases/:id/timeline', async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const db = getDb(c.env.DATABASE_URL);

  try {
    // Verify access
    const [tracking] = await db
      .select()
      .from($caseTracking)
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($caseTracking.caseId, caseId)
        )
      );

    if (!tracking) {
      return c.json({ error: 'Case not found' }, 404);
    }

    // Get all events and rulings for timeline
    const [rulings, events] = await Promise.all([
      db
        .select({
          type: sql<string>`'ruling'`,
          date: $rulings.rulingDate,
          title: $rulings.motionType,
          description: $rulings.outcome,
          data: $rulings,
        })
        .from($rulings)
        .where(eq($rulings.caseId, caseId)),
      db
        .select({
          type: sql<string>`'event'`,
          date: $caseEvents.eventDate,
          title: $caseEvents.eventType,
          description: $caseEvents.description,
          data: $caseEvents,
        })
        .from($caseEvents)
        .where(eq($caseEvents.caseId, caseId)),
    ]);

    // Combine and sort by date
    const timeline = [...rulings, ...events]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return c.json({ timeline });
  } catch (error) {
    logger.error('Failed to get timeline', { userId, caseId, error: String(error) });
    return c.json({ error: 'Failed to get timeline' }, 500);
  }
});

/**
 * POST /cases/:id/refresh - Manually refresh case data
 */
app.post('/cases/:id/refresh', async (c) => {
  const userId = c.get('userId');
  const caseId = parseInt(c.req.param('id'));
  const db = getDb(c.env.DATABASE_URL);

  try {
    // Verify access
    const [tracking] = await db
      .select({ tracking: $caseTracking, case: $cases })
      .from($caseTracking)
      .innerJoin($cases, eq($caseTracking.caseId, $cases.id))
      .where(
        and(
          eq($caseTracking.userId, userId),
          eq($caseTracking.caseId, caseId)
        )
      );

    if (!tracking) {
      return c.json({ error: 'Case not found' }, 404);
    }

    // Queue refresh
    if (c.env.COURT_TRACKING_QUEUE) {
      await c.env.COURT_TRACKING_QUEUE.send({
        body: { caseId, action: 'refresh' },
      });

      return c.json({
        success: true,
        message: 'Refresh queued, updates will be available shortly',
      });
    }

    // If no queue, do synchronous refresh
    const trackingService = createTrackingService(db);
    const result = await trackingService.checkCaseForUpdates(caseId);

    return c.json({
      success: result.success,
      hasUpdates: result.hasUpdates,
      updates: result.updates,
    });
  } catch (error) {
    logger.error('Failed to refresh case', { userId, caseId, error: String(error) });
    return c.json({ error: 'Failed to refresh case' }, 500);
  }
});

export default app;
