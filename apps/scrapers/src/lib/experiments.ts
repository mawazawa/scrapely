/**
 * A/B Testing Framework
 * Feature flags and experiment management with analytics
 */

import { logger } from './logger';

/**
 * Experiment configuration
 */
export interface Experiment {
  id: string;
  name: string;
  description: string;
  variants: ExperimentVariant[];
  status: 'draft' | 'running' | 'paused' | 'completed';
  targetPercentage: number;
  startDate?: Date;
  endDate?: Date;
  metrics: ExperimentMetric[];
  segmentation?: ExperimentSegment;
}

/**
 * Experiment variant
 */
export interface ExperimentVariant {
  id: string;
  name: string;
  weight: number;
  config: Record<string, unknown>;
}

/**
 * Experiment metric
 */
export interface ExperimentMetric {
  name: string;
  type: 'conversion' | 'count' | 'duration' | 'revenue';
  goal?: 'increase' | 'decrease';
  minimumDetectableEffect?: number;
}

/**
 * Experiment segmentation
 */
export interface ExperimentSegment {
  regions?: string[];
  userTypes?: ('free' | 'pro' | 'enterprise')[];
  platforms?: ('web' | 'mobile' | 'api')[];
  customRules?: Array<{
    field: string;
    operator: 'equals' | 'contains' | 'gt' | 'lt';
    value: unknown;
  }>;
}

/**
 * User assignment
 */
export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Experiment result
 */
export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  metricName: string;
  value: number;
  sampleSize: number;
  confidence: number;
  isSignificant: boolean;
  relativeChange?: number;
}

/**
 * Feature flag definition
 */
export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  variants?: Record<string, unknown>;
  targeting?: ExperimentSegment;
}

/**
 * Default experiments
 */
export const DEFAULT_EXPERIMENTS: Experiment[] = [
  {
    id: 'brief-length-v1',
    name: 'Brief Summary Length',
    description: 'Test different brief summary lengths',
    status: 'draft',
    targetPercentage: 100,
    variants: [
      { id: 'control', name: 'Short (100 words)', weight: 50, config: { wordLimit: 100 } },
      { id: 'treatment', name: 'Medium (200 words)', weight: 50, config: { wordLimit: 200 } },
    ],
    metrics: [
      { name: 'read_time', type: 'duration', goal: 'increase' },
      { name: 'share_rate', type: 'conversion', goal: 'increase' },
    ],
  },
  {
    id: 'ai-model-v1',
    name: 'AI Model Comparison',
    description: 'Compare different AI models for analysis quality',
    status: 'draft',
    targetPercentage: 20,
    variants: [
      { id: 'gemini', name: 'Gemini 3 Flash', weight: 50, config: { model: 'gemini-3-flash' } },
      { id: 'gpt', name: 'GPT-5.2', weight: 50, config: { model: 'gpt-5.2' } },
    ],
    metrics: [
      { name: 'quality_rating', type: 'count', goal: 'increase' },
      { name: 'processing_time', type: 'duration', goal: 'decrease' },
    ],
  },
];

/**
 * Default feature flags
 */
export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'semantic-search',
    name: 'Semantic Search',
    description: 'Enable AI-powered semantic search',
    enabled: true,
    rolloutPercentage: 100,
  },
  {
    id: 'push-notifications',
    name: 'Push Notifications',
    description: 'Enable web push notifications',
    enabled: true,
    rolloutPercentage: 50,
  },
  {
    id: 'dark-mode',
    name: 'Dark Mode',
    description: 'Enable dark mode theme',
    enabled: true,
    rolloutPercentage: 100,
  },
  {
    id: 'export-pdf',
    name: 'PDF Export',
    description: 'Enable PDF export functionality',
    enabled: true,
    rolloutPercentage: 100,
  },
];

/**
 * Experiment manager
 */
export class ExperimentManager {
  private kv: KVNamespace | undefined;
  private experiments: Map<string, Experiment> = new Map();
  private featureFlags: Map<string, FeatureFlag> = new Map();

  constructor(kv?: KVNamespace) {
    this.kv = kv;

    // Initialize with defaults
    DEFAULT_EXPERIMENTS.forEach(exp => this.experiments.set(exp.id, exp));
    DEFAULT_FEATURE_FLAGS.forEach(flag => this.featureFlags.set(flag.id, flag));
  }

  /**
   * Get user's variant for an experiment
   */
  async getVariant(experimentId: string, userId: string): Promise<ExperimentVariant | null> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Check if user matches targeting criteria
    // (simplified - would check segmentation in production)

    // Check for existing assignment
    const existingAssignment = await this.getAssignment(experimentId, userId);
    if (existingAssignment) {
      const variant = experiment.variants.find(v => v.id === existingAssignment.variantId);
      return variant || null;
    }

    // Check target percentage
    const userHash = this.hashUserId(userId + experimentId);
    if (userHash > experiment.targetPercentage) {
      return null;
    }

    // Assign variant based on weights
    const variant = this.selectVariant(experiment.variants, userId + experimentId);

    // Store assignment
    await this.storeAssignment({
      experimentId,
      variantId: variant.id,
      userId,
      assignedAt: new Date(),
    });

    logger.info('User assigned to experiment variant', {
      experimentId,
      variantId: variant.id,
      userId: userId.slice(0, 8),
    });

    return variant;
  }

  /**
   * Check if feature flag is enabled for user
   */
  async isFeatureEnabled(flagId: string, userId: string): Promise<boolean> {
    const flag = this.featureFlags.get(flagId);
    if (!flag || !flag.enabled) {
      return false;
    }

    // Check rollout percentage
    const userHash = this.hashUserId(userId + flagId);
    return userHash <= flag.rolloutPercentage;
  }

  /**
   * Get feature flag value with variants
   */
  async getFeatureValue<T>(flagId: string, userId: string, defaultValue: T): Promise<T> {
    const enabled = await this.isFeatureEnabled(flagId, userId);
    if (!enabled) {
      return defaultValue;
    }

    const flag = this.featureFlags.get(flagId);
    if (flag?.variants) {
      return flag.variants as T;
    }

    return defaultValue;
  }

  /**
   * Track experiment event
   */
  async trackEvent(
    experimentId: string,
    userId: string,
    eventName: string,
    value?: number
  ): Promise<void> {
    const assignment = await this.getAssignment(experimentId, userId);
    if (!assignment) return;

    const eventKey = `experiment:${experimentId}:${assignment.variantId}:${eventName}`;

    if (this.kv) {
      const existing = await this.kv.get<{ count: number; sum: number }>(eventKey, 'json');
      const updated = {
        count: (existing?.count || 0) + 1,
        sum: (existing?.sum || 0) + (value || 1),
      };
      await this.kv.put(eventKey, JSON.stringify(updated), { expirationTtl: 60 * 60 * 24 * 90 });
    }

    logger.debug('Experiment event tracked', {
      experimentId,
      variantId: assignment.variantId,
      eventName,
      value,
    });
  }

  /**
   * Get experiment results
   */
  async getResults(experimentId: string): Promise<ExperimentResult[]> {
    const experiment = this.experiments.get(experimentId);
    if (!experiment) return [];

    const results: ExperimentResult[] = [];

    for (const variant of experiment.variants) {
      for (const metric of experiment.metrics) {
        const eventKey = `experiment:${experimentId}:${variant.id}:${metric.name}`;

        if (this.kv) {
          const data = await this.kv.get<{ count: number; sum: number }>(eventKey, 'json');

          results.push({
            experimentId,
            variantId: variant.id,
            metricName: metric.name,
            value: data?.sum || 0,
            sampleSize: data?.count || 0,
            confidence: this.calculateConfidence(data?.count || 0),
            isSignificant: (data?.count || 0) >= 100,
          });
        }
      }
    }

    return results;
  }

  /**
   * Update experiment status
   */
  async updateExperimentStatus(experimentId: string, status: Experiment['status']): Promise<void> {
    const experiment = this.experiments.get(experimentId);
    if (experiment) {
      experiment.status = status;
      if (status === 'running') {
        experiment.startDate = new Date();
      } else if (status === 'completed') {
        experiment.endDate = new Date();
      }
      this.experiments.set(experimentId, experiment);

      logger.info('Experiment status updated', { experimentId, status });
    }
  }

  /**
   * Create new experiment
   */
  async createExperiment(experiment: Omit<Experiment, 'id'>): Promise<Experiment> {
    const id = crypto.randomUUID();
    const newExperiment: Experiment = {
      id,
      ...experiment,
      status: 'draft',
    };

    this.experiments.set(id, newExperiment);

    logger.info('Experiment created', { experimentId: id, name: experiment.name });

    return newExperiment;
  }

  /**
   * Update feature flag
   */
  async updateFeatureFlag(flagId: string, updates: Partial<FeatureFlag>): Promise<void> {
    const flag = this.featureFlags.get(flagId);
    if (flag) {
      const updated = { ...flag, ...updates };
      this.featureFlags.set(flagId, updated);

      logger.info('Feature flag updated', { flagId, updates });
    }
  }

  /**
   * Get existing assignment
   */
  private async getAssignment(experimentId: string, userId: string): Promise<ExperimentAssignment | null> {
    if (!this.kv) return null;

    const key = `assignment:${experimentId}:${userId}`;
    return this.kv.get<ExperimentAssignment>(key, 'json');
  }

  /**
   * Store assignment
   */
  private async storeAssignment(assignment: ExperimentAssignment): Promise<void> {
    if (!this.kv) return;

    const key = `assignment:${assignment.experimentId}:${assignment.userId}`;
    await this.kv.put(key, JSON.stringify(assignment), {
      expirationTtl: 60 * 60 * 24 * 90, // 90 days
    });
  }

  /**
   * Select variant based on weights
   */
  private selectVariant(variants: ExperimentVariant[], seed: string): ExperimentVariant {
    const hash = this.hashUserId(seed);
    const totalWeight = variants.reduce((sum, v) => sum + v.weight, 0);
    const normalizedHash = (hash / 100) * totalWeight;

    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (normalizedHash <= cumulative) {
        return variant;
      }
    }

    return variants[variants.length - 1];
  }

  /**
   * Hash user ID to percentage (0-100)
   */
  private hashUserId(userId: string): number {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash % 100);
  }

  /**
   * Calculate statistical confidence
   */
  private calculateConfidence(sampleSize: number): number {
    // Simplified confidence calculation
    if (sampleSize < 30) return 0;
    if (sampleSize < 100) return 0.8;
    if (sampleSize < 1000) return 0.9;
    return 0.95;
  }
}

/**
 * Create experiment manager singleton
 */
export function createExperimentManager(kv?: KVNamespace): ExperimentManager {
  return new ExperimentManager(kv);
}

/**
 * React/Vue hook helper for experiments
 */
export interface UseExperimentResult {
  variant: ExperimentVariant | null;
  isLoading: boolean;
  trackConversion: (value?: number) => Promise<void>;
}

/**
 * Helper to check multiple feature flags
 */
export async function checkFeatureFlags(
  manager: ExperimentManager,
  userId: string,
  flagIds: string[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  for (const flagId of flagIds) {
    results[flagId] = await manager.isFeatureEnabled(flagId, userId);
  }

  return results;
}
