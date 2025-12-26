import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createMistral } from '@ai-sdk/mistral';
import { Env } from '../index';

/**
 * AI Model Configuration for Meridian
 * Using cutting-edge models as of December 2025
 */

export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

export interface ModelConfig {
  provider: 'google' | 'openai' | 'anthropic' | 'mistral';
  model: string;
  thinkingLevel?: ThinkingLevel;
  reasoningEffort?: 'low' | 'medium' | 'high';
}

// Model tiers for different processing needs
export const MODELS = {
  // Fast triage - language detection, relevance check
  triage: {
    provider: 'google',
    model: 'gemini-3-flash',
    thinkingLevel: 'minimal',
  } as ModelConfig,

  // Standard article analysis
  analysis: {
    provider: 'google',
    model: 'gemini-3-flash',
    thinkingLevel: 'low',
  } as ModelConfig,

  // Complex/long articles requiring deeper analysis
  deep: {
    provider: 'google',
    model: 'gemini-3-pro',
    thinkingLevel: 'high',
  } as ModelConfig,

  // Cluster synthesis for briefs
  synthesis: {
    provider: 'openai',
    model: 'gpt-5.2',
    reasoningEffort: 'high',
  } as ModelConfig,
} as const;

// Fallback chain for resilience
export const FALLBACK_CHAIN: ModelConfig[] = [
  { provider: 'google', model: 'gemini-3-flash', thinkingLevel: 'low' },
  { provider: 'google', model: 'gemini-3-pro', thinkingLevel: 'minimal' },
  { provider: 'anthropic', model: 'claude-sonnet-4.5' },
  { provider: 'openai', model: 'gpt-5.2', reasoningEffort: 'low' },
  { provider: 'mistral', model: 'mistral-large-3' },
];

// Initialize providers
export function getProviders(env: Env) {
  return {
    google: createGoogleGenerativeAI({
      apiKey: env.GOOGLE_API_KEY,
      baseURL: env.GOOGLE_BASE_URL,
    }),
    openai: env.OPENAI_API_KEY
      ? createOpenAI({ apiKey: env.OPENAI_API_KEY })
      : null,
    anthropic: env.ANTHROPIC_API_KEY
      ? createAnthropic({ apiKey: env.ANTHROPIC_API_KEY })
      : null,
    mistral: env.MISTRAL_API_KEY
      ? createMistral({ apiKey: env.MISTRAL_API_KEY })
      : null,
  };
}

// Get the appropriate model for a given tier
export function getModel(env: Env, tier: keyof typeof MODELS) {
  const config = MODELS[tier];
  const providers = getProviders(env);

  switch (config.provider) {
    case 'google':
      return providers.google(config.model);
    case 'openai':
      if (!providers.openai) throw new Error('OpenAI API key not configured');
      return providers.openai(config.model);
    case 'anthropic':
      if (!providers.anthropic) throw new Error('Anthropic API key not configured');
      return providers.anthropic(config.model);
    case 'mistral':
      if (!providers.mistral) throw new Error('Mistral API key not configured');
      return providers.mistral(config.model);
    default:
      throw new Error(`Unknown provider: ${config.provider}`);
  }
}
