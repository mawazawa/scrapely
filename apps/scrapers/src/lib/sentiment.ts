/**
 * Article Sentiment Analysis
 * AI-powered sentiment scoring using Gemini
 */

import { z } from 'zod';
import { generateObject } from 'ai';
import { google } from '@ai-sdk/google';
import { logger } from './logger';

/**
 * Sentiment result schema
 */
export const SentimentResultSchema = z.object({
  score: z.number().min(-1).max(1).describe('Sentiment score from -1 (very negative) to 1 (very positive)'),
  magnitude: z.number().min(0).max(1).describe('Emotional intensity from 0 (neutral) to 1 (highly emotional)'),
  label: z.enum(['very_negative', 'negative', 'neutral', 'positive', 'very_positive']).describe('Human-readable sentiment label'),
  confidence: z.number().min(0).max(1).describe('Confidence in the sentiment analysis'),
  aspects: z.array(z.object({
    aspect: z.string().describe('Topic or entity being discussed'),
    sentiment: z.enum(['negative', 'neutral', 'positive']).describe('Sentiment toward this aspect'),
    mentions: z.number().describe('Number of mentions'),
  })).optional().describe('Aspect-based sentiment breakdown'),
  emotions: z.object({
    joy: z.number().min(0).max(1).optional(),
    sadness: z.number().min(0).max(1).optional(),
    anger: z.number().min(0).max(1).optional(),
    fear: z.number().min(0).max(1).optional(),
    surprise: z.number().min(0).max(1).optional(),
    trust: z.number().min(0).max(1).optional(),
  }).optional().describe('Emotion breakdown'),
  reasoning: z.string().optional().describe('Brief explanation of the sentiment assessment'),
});

export type SentimentResult = z.infer<typeof SentimentResultSchema>;

/**
 * Sentiment analysis configuration
 */
export interface SentimentConfig {
  model: string;
  includeAspects: boolean;
  includeEmotions: boolean;
  includeReasoning: boolean;
  maxContentLength: number;
}

/**
 * Default sentiment configuration
 */
export const DEFAULT_SENTIMENT_CONFIG: SentimentConfig = {
  model: 'gemini-2.0-flash',
  includeAspects: true,
  includeEmotions: true,
  includeReasoning: false,
  maxContentLength: 5000,
};

/**
 * System prompt for sentiment analysis
 */
const SENTIMENT_PROMPT = `You are an expert sentiment analyst specializing in news content analysis.

Analyze the sentiment of the provided news article content. Consider:

1. **Overall Tone**: Is the article positive, negative, or neutral?
2. **Emotional Intensity**: How emotionally charged is the content?
3. **Aspect Sentiment**: What specific topics/entities are discussed and what's the sentiment toward each?
4. **Contextual Factors**: Consider journalistic objectivity vs editorial opinion

Scoring Guidelines:
- Score -1.0 to -0.6: Very negative (disaster, tragedy, strong criticism)
- Score -0.6 to -0.2: Negative (problems, concerns, criticism)
- Score -0.2 to 0.2: Neutral (factual reporting, balanced coverage)
- Score 0.2 to 0.6: Positive (achievements, improvements, praise)
- Score 0.6 to 1.0: Very positive (celebrations, breakthroughs, strong endorsements)

Be objective and account for journalistic standards - news often reports negative events neutrally.`;

/**
 * Analyze sentiment of article content
 */
export async function analyzeSentiment(
  content: string,
  title?: string,
  config: Partial<SentimentConfig> = {}
): Promise<SentimentResult> {
  const cfg = { ...DEFAULT_SENTIMENT_CONFIG, ...config };

  // Truncate content if too long
  const truncatedContent = content.slice(0, cfg.maxContentLength);
  const fullContent = title ? `Title: ${title}\n\nContent: ${truncatedContent}` : truncatedContent;

  try {
    const { object } = await generateObject({
      model: google(cfg.model),
      schema: SentimentResultSchema,
      system: SENTIMENT_PROMPT,
      prompt: `Analyze the sentiment of this news article:\n\n${fullContent}`,
    });

    logger.debug('Sentiment analysis completed', {
      score: object.score,
      label: object.label,
      confidence: object.confidence,
    });

    return object;
  } catch (error) {
    logger.error('Sentiment analysis failed', { error: String(error) });

    // Return neutral sentiment on error
    return {
      score: 0,
      magnitude: 0,
      label: 'neutral',
      confidence: 0,
    };
  }
}

/**
 * Quick sentiment analysis (simpler, faster)
 */
export async function quickSentiment(content: string): Promise<{
  score: number;
  label: 'negative' | 'neutral' | 'positive';
}> {
  const result = await analyzeSentiment(content, undefined, {
    includeAspects: false,
    includeEmotions: false,
    includeReasoning: false,
  });

  // Simplify to 3-way classification
  let label: 'negative' | 'neutral' | 'positive';
  if (result.score < -0.2) {
    label = 'negative';
  } else if (result.score > 0.2) {
    label = 'positive';
  } else {
    label = 'neutral';
  }

  return { score: result.score, label };
}

/**
 * Batch sentiment analysis
 */
export async function batchAnalyzeSentiment(
  articles: Array<{ id: number; title: string; content: string }>,
  config: Partial<SentimentConfig> = {}
): Promise<Map<number, SentimentResult>> {
  const results = new Map<number, SentimentResult>();

  // Process in parallel batches of 10
  const batchSize = 10;
  for (let i = 0; i < articles.length; i += batchSize) {
    const batch = articles.slice(i, i + batchSize);

    const batchResults = await Promise.allSettled(
      batch.map(article =>
        analyzeSentiment(article.content, article.title, config)
          .then(result => ({ id: article.id, result }))
      )
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.set(result.value.id, result.value.result);
      }
    }
  }

  logger.info('Batch sentiment analysis completed', {
    total: articles.length,
    successful: results.size,
  });

  return results;
}

/**
 * Calculate aggregate sentiment for multiple articles
 */
export function aggregateSentiment(results: SentimentResult[]): {
  averageScore: number;
  distribution: Record<string, number>;
  dominantSentiment: string;
  overallMagnitude: number;
} {
  if (results.length === 0) {
    return {
      averageScore: 0,
      distribution: {},
      dominantSentiment: 'neutral',
      overallMagnitude: 0,
    };
  }

  const averageScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
  const overallMagnitude = results.reduce((sum, r) => sum + r.magnitude, 0) / results.length;

  // Calculate distribution
  const distribution: Record<string, number> = {};
  for (const result of results) {
    distribution[result.label] = (distribution[result.label] || 0) + 1;
  }

  // Normalize distribution to percentages
  for (const label of Object.keys(distribution)) {
    distribution[label] = Math.round((distribution[label] / results.length) * 100);
  }

  // Find dominant sentiment
  let dominantSentiment = 'neutral';
  let maxCount = 0;
  for (const [label, count] of Object.entries(distribution)) {
    if (count > maxCount) {
      maxCount = count;
      dominantSentiment = label;
    }
  }

  return {
    averageScore: Math.round(averageScore * 1000) / 1000,
    distribution,
    dominantSentiment,
    overallMagnitude: Math.round(overallMagnitude * 1000) / 1000,
  };
}

/**
 * Sentiment trend analysis over time
 */
export interface SentimentTrend {
  date: string;
  averageScore: number;
  articleCount: number;
  positiveRate: number;
  negativeRate: number;
}

/**
 * Calculate sentiment trends from time-series data
 */
export function calculateSentimentTrends(
  data: Array<{ date: string; sentiment: SentimentResult }>
): SentimentTrend[] {
  // Group by date
  const byDate = new Map<string, SentimentResult[]>();
  for (const item of data) {
    const existing = byDate.get(item.date) || [];
    existing.push(item.sentiment);
    byDate.set(item.date, existing);
  }

  // Calculate trends for each date
  const trends: SentimentTrend[] = [];
  for (const [date, sentiments] of byDate.entries()) {
    const averageScore = sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length;
    const positiveCount = sentiments.filter(s => s.score > 0.2).length;
    const negativeCount = sentiments.filter(s => s.score < -0.2).length;

    trends.push({
      date,
      averageScore: Math.round(averageScore * 1000) / 1000,
      articleCount: sentiments.length,
      positiveRate: Math.round((positiveCount / sentiments.length) * 100),
      negativeRate: Math.round((negativeCount / sentiments.length) * 100),
    });
  }

  // Sort by date
  trends.sort((a, b) => a.date.localeCompare(b.date));

  return trends;
}

/**
 * Detect significant sentiment shifts
 */
export function detectSentimentShifts(
  trends: SentimentTrend[],
  threshold: number = 0.3
): Array<{ date: string; shift: number; direction: 'positive' | 'negative' }> {
  const shifts: Array<{ date: string; shift: number; direction: 'positive' | 'negative' }> = [];

  for (let i = 1; i < trends.length; i++) {
    const shift = trends[i].averageScore - trends[i - 1].averageScore;

    if (Math.abs(shift) >= threshold) {
      shifts.push({
        date: trends[i].date,
        shift: Math.round(shift * 1000) / 1000,
        direction: shift > 0 ? 'positive' : 'negative',
      });
    }
  }

  return shifts;
}

/**
 * Compare sentiment between two topics/entities
 */
export function compareSentiment(
  topic1: { name: string; sentiments: SentimentResult[] },
  topic2: { name: string; sentiments: SentimentResult[] }
): {
  topic1Score: number;
  topic2Score: number;
  difference: number;
  morePositive: string;
} {
  const score1 = topic1.sentiments.reduce((sum, s) => sum + s.score, 0) / topic1.sentiments.length;
  const score2 = topic2.sentiments.reduce((sum, s) => sum + s.score, 0) / topic2.sentiments.length;

  return {
    topic1Score: Math.round(score1 * 1000) / 1000,
    topic2Score: Math.round(score2 * 1000) / 1000,
    difference: Math.round((score1 - score2) * 1000) / 1000,
    morePositive: score1 >= score2 ? topic1.name : topic2.name,
  };
}
