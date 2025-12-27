/**
 * Content moderation pipeline
 * Uses AI to detect and flag harmful content
 */

import { z } from 'zod';
import { logger } from './logger';
import { Env } from '../index';

/**
 * Moderation result schema
 */
export const ModerationResultSchema = z.object({
  flagged: z.boolean(),
  categories: z.object({
    hate: z.boolean().default(false),
    violence: z.boolean().default(false),
    sexual: z.boolean().default(false),
    selfHarm: z.boolean().default(false),
    harassment: z.boolean().default(false),
    dangerous: z.boolean().default(false),
  }),
  scores: z.object({
    hate: z.number().min(0).max(1).default(0),
    violence: z.number().min(0).max(1).default(0),
    sexual: z.number().min(0).max(1).default(0),
    selfHarm: z.number().min(0).max(1).default(0),
    harassment: z.number().min(0).max(1).default(0),
    dangerous: z.number().min(0).max(1).default(0),
  }),
  reason: z.string().optional(),
  confidence: z.number().min(0).max(1),
});

export type ModerationResult = z.infer<typeof ModerationResultSchema>;

/**
 * Moderation thresholds
 */
export const MODERATION_THRESHOLDS = {
  hate: 0.7,
  violence: 0.8,
  sexual: 0.7,
  selfHarm: 0.6,
  harassment: 0.7,
  dangerous: 0.8,
};

/**
 * Blocklist for immediate rejection
 */
const BLOCKLIST_PATTERNS = [
  // Add patterns that should be immediately blocked
  /\b(explicit_term_1|explicit_term_2)\b/i,
];

/**
 * Allowlist for news content
 */
const NEWS_CONTEXT_ALLOWLIST = [
  'war',
  'conflict',
  'attack',
  'terrorism',
  'violence',
  // These terms are allowed in news context
];

/**
 * Check content against blocklist
 */
export function checkBlocklist(content: string): { blocked: boolean; pattern?: string } {
  for (const pattern of BLOCKLIST_PATTERNS) {
    if (pattern.test(content)) {
      return { blocked: true, pattern: pattern.source };
    }
  }
  return { blocked: false };
}

/**
 * Moderate content using AI
 */
export async function moderateContent(
  env: Env,
  content: string,
  title?: string
): Promise<ModerationResult> {
  // Quick blocklist check
  const blocklistResult = checkBlocklist(content);
  if (blocklistResult.blocked) {
    return {
      flagged: true,
      categories: {
        hate: false,
        violence: false,
        sexual: false,
        selfHarm: false,
        harassment: false,
        dangerous: true,
      },
      scores: {
        hate: 0,
        violence: 0,
        sexual: 0,
        selfHarm: 0,
        harassment: 0,
        dangerous: 1.0,
      },
      reason: `Blocked by pattern: ${blocklistResult.pattern}`,
      confidence: 1.0,
    };
  }

  try {
    // Use Gemini for moderation
    const response = await fetch(`${env.GOOGLE_BASE_URL}/v1beta/models/gemini-2.0-flash:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': env.GOOGLE_API_KEY,
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze this news article for content moderation. This is a news context, so discussions of violence, conflict, or sensitive topics in a journalistic manner are acceptable.

Title: ${title || 'Unknown'}
Content: ${content.slice(0, 5000)}

Rate each category from 0.0 to 1.0:
- hate: Hate speech or discrimination
- violence: Gratuitous violence (not news reporting)
- sexual: Sexual content
- selfHarm: Self-harm promotion
- harassment: Targeted harassment
- dangerous: Dangerous activities promotion

Respond in JSON:
{
  "flagged": boolean,
  "categories": { "hate": boolean, ... },
  "scores": { "hate": 0.0-1.0, ... },
  "reason": "if flagged, explain why",
  "confidence": 0.0-1.0
}`,
          }],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
        },
        safetySettings: [
          // Allow analysis of potentially harmful content
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Gemini error: ${response.status}`);
    }

    const data = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';

    const result = JSON.parse(text);
    return ModerationResultSchema.parse(result);
  } catch (error) {
    logger.error('Moderation failed', { error: String(error) });

    // Return safe default on error
    return {
      flagged: false,
      categories: {
        hate: false,
        violence: false,
        sexual: false,
        selfHarm: false,
        harassment: false,
        dangerous: false,
      },
      scores: {
        hate: 0,
        violence: 0,
        sexual: 0,
        selfHarm: 0,
        harassment: 0,
        dangerous: 0,
      },
      confidence: 0,
    };
  }
}

/**
 * Check if content should be flagged based on thresholds
 */
export function shouldFlag(result: ModerationResult): boolean {
  if (result.flagged) return true;

  for (const [category, score] of Object.entries(result.scores)) {
    const threshold = MODERATION_THRESHOLDS[category as keyof typeof MODERATION_THRESHOLDS];
    if (threshold && score >= threshold) {
      return true;
    }
  }

  return false;
}

/**
 * Get moderation action
 */
export function getModerationAction(result: ModerationResult): 'allow' | 'review' | 'block' {
  // High confidence block
  if (result.confidence >= 0.9 && result.flagged) {
    return 'block';
  }

  // Needs review
  if (shouldFlag(result)) {
    return 'review';
  }

  return 'allow';
}

/**
 * Moderation queue item
 */
export interface ModerationQueueItem {
  id: string;
  articleId: number;
  title: string;
  contentPreview: string;
  result: ModerationResult;
  action: 'review' | 'block';
  createdAt: number;
  reviewedAt?: number;
  reviewedBy?: string;
  decision?: 'approved' | 'rejected';
}

/**
 * Add to moderation queue
 */
export async function addToModerationQueue(
  kv: KVNamespace | undefined,
  item: Omit<ModerationQueueItem, 'id' | 'createdAt'>
): Promise<string | null> {
  if (!kv) return null;

  const id = crypto.randomUUID();
  const queueItem: ModerationQueueItem = {
    ...item,
    id,
    createdAt: Date.now(),
  };

  try {
    await kv.put(`moderation:${id}`, JSON.stringify(queueItem), {
      expirationTtl: 7 * 24 * 60 * 60, // 7 days
    });

    // Add to queue list
    const queueList = await kv.get<string[]>('moderation:queue', 'json') || [];
    queueList.push(id);
    await kv.put('moderation:queue', JSON.stringify(queueList));

    logger.info('Added to moderation queue', { id, articleId: item.articleId });
    return id;
  } catch {
    return null;
  }
}

/**
 * Get moderation queue
 */
export async function getModerationQueue(
  kv: KVNamespace | undefined
): Promise<ModerationQueueItem[]> {
  if (!kv) return [];

  try {
    const queueIds = await kv.get<string[]>('moderation:queue', 'json') || [];
    const items: ModerationQueueItem[] = [];

    for (const id of queueIds) {
      const item = await kv.get<ModerationQueueItem>(`moderation:${id}`, 'json');
      if (item && !item.reviewedAt) {
        items.push(item);
      }
    }

    return items.sort((a, b) => b.createdAt - a.createdAt);
  } catch {
    return [];
  }
}

/**
 * Review moderation item
 */
export async function reviewModerationItem(
  kv: KVNamespace | undefined,
  id: string,
  decision: 'approved' | 'rejected',
  reviewerId: string
): Promise<boolean> {
  if (!kv) return false;

  try {
    const item = await kv.get<ModerationQueueItem>(`moderation:${id}`, 'json');
    if (!item) return false;

    item.reviewedAt = Date.now();
    item.reviewedBy = reviewerId;
    item.decision = decision;

    await kv.put(`moderation:${id}`, JSON.stringify(item));

    logger.info('Moderation reviewed', { id, decision, reviewerId });
    return true;
  } catch {
    return false;
  }
}
