/**
 * Source Quality Scoring System
 * Calculates and maintains quality scores for news sources
 */

import { logger } from './logger';

/**
 * Quality factors and their weights
 */
export interface QualityFactors {
  reliability: number;      // Historical accuracy/success rate
  timeliness: number;       // How quickly articles are published
  contentQuality: number;   // Depth, accuracy, writing quality
  coverage: number;         // Breadth of topics covered
  uniqueness: number;       // Original content vs aggregation
  engagement: number;       // User engagement metrics
  credibility: number;      // Domain authority, fact-checking
}

/**
 * Quality weights configuration
 */
export const QUALITY_WEIGHTS: QualityFactors = {
  reliability: 0.20,
  timeliness: 0.10,
  contentQuality: 0.25,
  coverage: 0.10,
  uniqueness: 0.15,
  engagement: 0.05,
  credibility: 0.15,
};

/**
 * Quality tier thresholds
 */
export type QualityTier = 'premium' | 'standard' | 'basic' | 'low' | 'untrusted';

export const QUALITY_TIERS: Record<QualityTier, { min: number; max: number; description: string }> = {
  premium: { min: 0.85, max: 1.0, description: 'Top-tier, highly reliable source' },
  standard: { min: 0.7, max: 0.85, description: 'Good quality, generally reliable' },
  basic: { min: 0.5, max: 0.7, description: 'Acceptable quality, use with caution' },
  low: { min: 0.3, max: 0.5, description: 'Low quality, limited trust' },
  untrusted: { min: 0, max: 0.3, description: 'Unreliable, not recommended' },
};

/**
 * Source quality data
 */
export interface SourceQualityData {
  sourceId: number;
  overallScore: number;
  factors: QualityFactors;
  tier: QualityTier;
  lastUpdated: Date;
  articleCount: number;
  sampleSize: number;
  confidence: number;  // Statistical confidence in the score
}

/**
 * Metrics for quality calculation
 */
export interface SourceMetrics {
  // Reliability
  successfulScrapes: number;
  failedScrapes: number;
  avgResponseTimeMs: number;

  // Timeliness
  avgPublishDelayMinutes: number;
  breakingNewsCount: number;

  // Content Quality
  avgArticleLength: number;
  avgReadingGrade: number;  // Flesch-Kincaid
  avgEntityCount: number;

  // Coverage
  topicDiversity: number;  // Number of unique topics
  regionCoverage: number;  // Geographic spread

  // Uniqueness
  duplicateRate: number;
  originalContentRate: number;

  // Engagement
  avgReadTime: number;
  shareRate: number;

  // Credibility
  domainAge: number;       // Years
  factCheckScore: number;  // External fact-check rating
  citationCount: number;   // How often cited by others
}

/**
 * Calculate overall quality score
 */
export function calculateQualityScore(metrics: SourceMetrics): SourceQualityData {
  const factors = calculateFactors(metrics);
  const overallScore = calculateOverallScore(factors);
  const tier = determineTier(overallScore);
  const confidence = calculateConfidence(metrics);

  return {
    sourceId: 0, // Set by caller
    overallScore,
    factors,
    tier,
    lastUpdated: new Date(),
    articleCount: 0, // Set by caller
    sampleSize: metrics.successfulScrapes + metrics.failedScrapes,
    confidence,
  };
}

/**
 * Calculate individual quality factors
 */
function calculateFactors(metrics: SourceMetrics): QualityFactors {
  return {
    reliability: calculateReliability(metrics),
    timeliness: calculateTimeliness(metrics),
    contentQuality: calculateContentQuality(metrics),
    coverage: calculateCoverage(metrics),
    uniqueness: calculateUniqueness(metrics),
    engagement: calculateEngagement(metrics),
    credibility: calculateCredibility(metrics),
  };
}

/**
 * Calculate reliability score (0-1)
 */
function calculateReliability(metrics: SourceMetrics): number {
  const total = metrics.successfulScrapes + metrics.failedScrapes;
  if (total === 0) return 0.5; // No data

  const successRate = metrics.successfulScrapes / total;

  // Penalize slow response times
  const responseTimePenalty = Math.max(0, 1 - (metrics.avgResponseTimeMs / 10000));

  return successRate * 0.7 + responseTimePenalty * 0.3;
}

/**
 * Calculate timeliness score (0-1)
 */
function calculateTimeliness(metrics: SourceMetrics): number {
  // Ideal: articles published within 30 minutes
  const delayScore = Math.max(0, 1 - (metrics.avgPublishDelayMinutes / 120));

  // Bonus for breaking news
  const breakingBonus = Math.min(0.2, metrics.breakingNewsCount * 0.02);

  return Math.min(1, delayScore + breakingBonus);
}

/**
 * Calculate content quality score (0-1)
 */
function calculateContentQuality(metrics: SourceMetrics): number {
  // Article length (ideal: 500-2000 words)
  const lengthScore = normalizeRange(metrics.avgArticleLength, 500, 2000);

  // Reading grade (ideal: 8-12 grade level)
  const gradeScore = normalizeRange(metrics.avgReadingGrade, 8, 12);

  // Entity richness (more entities = more informative)
  const entityScore = Math.min(1, metrics.avgEntityCount / 10);

  return lengthScore * 0.4 + gradeScore * 0.3 + entityScore * 0.3;
}

/**
 * Calculate coverage score (0-1)
 */
function calculateCoverage(metrics: SourceMetrics): number {
  // Topic diversity (ideal: 10+ topics)
  const topicScore = Math.min(1, metrics.topicDiversity / 10);

  // Region coverage
  const regionScore = Math.min(1, metrics.regionCoverage / 5);

  return topicScore * 0.6 + regionScore * 0.4;
}

/**
 * Calculate uniqueness score (0-1)
 */
function calculateUniqueness(metrics: SourceMetrics): number {
  // Penalize high duplicate rate
  const duplicatePenalty = metrics.duplicateRate;

  // Reward original content
  const originalBonus = metrics.originalContentRate;

  return Math.max(0, (1 - duplicatePenalty) * 0.5 + originalBonus * 0.5);
}

/**
 * Calculate engagement score (0-1)
 */
function calculateEngagement(metrics: SourceMetrics): number {
  // Average read time (ideal: 2-5 minutes)
  const readTimeScore = normalizeRange(metrics.avgReadTime, 2, 5);

  // Share rate
  const shareScore = Math.min(1, metrics.shareRate * 10);

  return readTimeScore * 0.6 + shareScore * 0.4;
}

/**
 * Calculate credibility score (0-1)
 */
function calculateCredibility(metrics: SourceMetrics): number {
  // Domain age (10+ years is ideal)
  const ageScore = Math.min(1, metrics.domainAge / 10);

  // External fact-check score
  const factCheckScore = metrics.factCheckScore;

  // Citation frequency
  const citationScore = Math.min(1, metrics.citationCount / 100);

  return ageScore * 0.2 + factCheckScore * 0.5 + citationScore * 0.3;
}

/**
 * Calculate overall score from factors
 */
function calculateOverallScore(factors: QualityFactors): number {
  let score = 0;

  for (const [key, weight] of Object.entries(QUALITY_WEIGHTS)) {
    score += factors[key as keyof QualityFactors] * weight;
  }

  return Math.round(score * 1000) / 1000; // Round to 3 decimals
}

/**
 * Determine quality tier from score
 */
function determineTier(score: number): QualityTier {
  for (const [tier, { min, max }] of Object.entries(QUALITY_TIERS)) {
    if (score >= min && score < max) {
      return tier as QualityTier;
    }
  }
  return 'untrusted';
}

/**
 * Calculate statistical confidence in the score
 */
function calculateConfidence(metrics: SourceMetrics): number {
  const sampleSize = metrics.successfulScrapes + metrics.failedScrapes;

  // Need at least 30 samples for reasonable confidence
  if (sampleSize < 10) return 0.3;
  if (sampleSize < 30) return 0.5;
  if (sampleSize < 100) return 0.7;
  if (sampleSize < 500) return 0.85;
  return 0.95;
}

/**
 * Normalize a value to 0-1 range with ideal min/max
 */
function normalizeRange(value: number, idealMin: number, idealMax: number): number {
  if (value < idealMin) {
    return value / idealMin;
  }
  if (value > idealMax) {
    return Math.max(0, 1 - (value - idealMax) / idealMax);
  }
  return 1;
}

/**
 * Quality score manager for batch operations
 */
export class QualityScoreManager {
  private kv: KVNamespace | undefined;

  constructor(kv?: KVNamespace) {
    this.kv = kv;
  }

  /**
   * Get quality score for a source
   */
  async getScore(sourceId: number): Promise<SourceQualityData | null> {
    if (!this.kv) return null;

    const key = `quality:${sourceId}`;
    return this.kv.get<SourceQualityData>(key, 'json');
  }

  /**
   * Update quality score for a source
   */
  async updateScore(sourceId: number, metrics: SourceMetrics): Promise<SourceQualityData> {
    const qualityData = calculateQualityScore(metrics);
    qualityData.sourceId = sourceId;

    if (this.kv) {
      const key = `quality:${sourceId}`;
      await this.kv.put(key, JSON.stringify(qualityData), {
        expirationTtl: 60 * 60 * 24 * 7, // 7 days
      });
    }

    logger.info('Updated source quality score', {
      sourceId,
      score: qualityData.overallScore,
      tier: qualityData.tier,
    });

    return qualityData;
  }

  /**
   * Get sources by quality tier
   */
  async getSourcesByTier(tier: QualityTier): Promise<number[]> {
    // In production, query database
    // For now, return empty array
    return [];
  }

  /**
   * Calculate brief weight based on quality
   */
  getBriefWeight(qualityData: SourceQualityData): number {
    // Premium sources get higher weight
    const tierWeights: Record<QualityTier, number> = {
      premium: 2.0,
      standard: 1.5,
      basic: 1.0,
      low: 0.5,
      untrusted: 0.1,
    };

    const tierWeight = tierWeights[qualityData.tier];
    const confidenceMultiplier = qualityData.confidence;

    return tierWeight * confidenceMultiplier;
  }

  /**
   * Check if source should be auto-disabled
   */
  shouldAutoDisable(qualityData: SourceQualityData): boolean {
    return (
      qualityData.tier === 'untrusted' &&
      qualityData.confidence >= 0.8 &&
      qualityData.factors.reliability < 0.2
    );
  }
}

/**
 * Default metrics for new sources
 */
export const DEFAULT_METRICS: SourceMetrics = {
  successfulScrapes: 0,
  failedScrapes: 0,
  avgResponseTimeMs: 1000,
  avgPublishDelayMinutes: 60,
  breakingNewsCount: 0,
  avgArticleLength: 500,
  avgReadingGrade: 10,
  avgEntityCount: 5,
  topicDiversity: 1,
  regionCoverage: 1,
  duplicateRate: 0,
  originalContentRate: 0.8,
  avgReadTime: 2,
  shareRate: 0.01,
  domainAge: 1,
  factCheckScore: 0.5,
  citationCount: 0,
};

/**
 * Known high-quality source domains
 */
export const PREMIUM_DOMAINS = [
  'reuters.com',
  'apnews.com',
  'bbc.com',
  'bbc.co.uk',
  'theguardian.com',
  'nytimes.com',
  'washingtonpost.com',
  'wsj.com',
  'ft.com',
  'economist.com',
  'nature.com',
  'science.org',
  'technologyreview.com',
];

/**
 * Check if domain is a known premium source
 */
export function isPremiumDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.replace('www.', '');
    return PREMIUM_DOMAINS.some(domain => hostname.endsWith(domain));
  } catch {
    return false;
  }
}
