/**
 * Article deduplication using SimHash
 * Detects duplicate and near-duplicate content
 */

import { logger } from './logger';

/**
 * SimHash configuration
 */
export const SIMHASH_CONFIG = {
  HASH_BITS: 64,
  SHINGLE_SIZE: 3, // n-gram size for shingling
  SIMILARITY_THRESHOLD: 0.85, // 85% similarity = duplicate
  HAMMING_THRESHOLD: 10, // Max hamming distance for duplicates (out of 64)
};

/**
 * Generate shingles (n-grams) from text
 */
export function generateShingles(text: string, size: number = SIMHASH_CONFIG.SHINGLE_SIZE): string[] {
  // Normalize text
  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '') // Remove punctuation
    .replace(/\s+/g, ' ') // Normalize whitespace
    .trim();

  const words = normalized.split(' ').filter(w => w.length > 0);
  const shingles: string[] = [];

  for (let i = 0; i <= words.length - size; i++) {
    shingles.push(words.slice(i, i + size).join(' '));
  }

  return shingles;
}

/**
 * Simple hash function for strings
 */
function hashString(str: string): bigint {
  let hash = BigInt(0);
  const prime = BigInt(31);
  const mod = BigInt(2) ** BigInt(64);

  for (let i = 0; i < str.length; i++) {
    hash = (hash * prime + BigInt(str.charCodeAt(i))) % mod;
  }

  return hash;
}

/**
 * Calculate SimHash for text content
 */
export function calculateSimHash(text: string): bigint {
  const shingles = generateShingles(text);
  const hashBits = SIMHASH_CONFIG.HASH_BITS;

  // Initialize vector of weights
  const weights = new Array(hashBits).fill(0);

  // For each shingle
  for (const shingle of shingles) {
    const hash = hashString(shingle);

    // For each bit position
    for (let i = 0; i < hashBits; i++) {
      const bit = (hash >> BigInt(i)) & BigInt(1);
      weights[i] += bit === BigInt(1) ? 1 : -1;
    }
  }

  // Convert weights to hash
  let simhash = BigInt(0);
  for (let i = 0; i < hashBits; i++) {
    if (weights[i] > 0) {
      simhash |= BigInt(1) << BigInt(i);
    }
  }

  return simhash;
}

/**
 * Calculate Hamming distance between two SimHashes
 */
export function hammingDistance(hash1: bigint, hash2: bigint): number {
  let xor = hash1 ^ hash2;
  let distance = 0;

  while (xor > BigInt(0)) {
    distance += Number(xor & BigInt(1));
    xor >>= BigInt(1);
  }

  return distance;
}

/**
 * Calculate similarity score between two hashes (0-1)
 */
export function similarityScore(hash1: bigint, hash2: bigint): number {
  const distance = hammingDistance(hash1, hash2);
  return 1 - distance / SIMHASH_CONFIG.HASH_BITS;
}

/**
 * Check if two articles are duplicates
 */
export function isDuplicate(hash1: bigint, hash2: bigint): boolean {
  const distance = hammingDistance(hash1, hash2);
  return distance <= SIMHASH_CONFIG.HAMMING_THRESHOLD;
}

/**
 * Check if two texts are duplicates
 */
export function areTextsDuplicate(text1: string, text2: string): boolean {
  const hash1 = calculateSimHash(text1);
  const hash2 = calculateSimHash(text2);
  return isDuplicate(hash1, hash2);
}

/**
 * Find duplicates in a list of articles
 */
export function findDuplicates(
  articles: Array<{ id: number; content: string; hash?: bigint }>
): Array<{ originalId: number; duplicateId: number; similarity: number }> {
  const duplicates: Array<{ originalId: number; duplicateId: number; similarity: number }> = [];

  // Calculate hashes if not provided
  const articlesWithHashes = articles.map(a => ({
    ...a,
    hash: a.hash || calculateSimHash(a.content),
  }));

  // Compare all pairs
  for (let i = 0; i < articlesWithHashes.length; i++) {
    for (let j = i + 1; j < articlesWithHashes.length; j++) {
      const similarity = similarityScore(
        articlesWithHashes[i].hash,
        articlesWithHashes[j].hash
      );

      if (similarity >= SIMHASH_CONFIG.SIMILARITY_THRESHOLD) {
        duplicates.push({
          originalId: articlesWithHashes[i].id,
          duplicateId: articlesWithHashes[j].id,
          similarity,
        });
      }
    }
  }

  return duplicates;
}

/**
 * Deduplication result
 */
export interface DeduplicationResult {
  isNew: boolean;
  duplicateOf?: number;
  similarity?: number;
  hash: string;
}

/**
 * Check article against existing hashes
 */
export async function checkForDuplicate(
  content: string,
  existingHashes: Map<number, bigint>
): Promise<DeduplicationResult> {
  const hash = calculateSimHash(content);

  for (const [articleId, existingHash] of existingHashes) {
    const similarity = similarityScore(hash, existingHash);

    if (similarity >= SIMHASH_CONFIG.SIMILARITY_THRESHOLD) {
      logger.info('Duplicate article detected', {
        duplicateOf: articleId,
        similarity,
      });

      return {
        isNew: false,
        duplicateOf: articleId,
        similarity,
        hash: hash.toString(16),
      };
    }
  }

  return {
    isNew: true,
    hash: hash.toString(16),
  };
}

/**
 * Convert hash to hex string for storage
 */
export function hashToHex(hash: bigint): string {
  return hash.toString(16).padStart(16, '0');
}

/**
 * Convert hex string to hash
 */
export function hexToHash(hex: string): bigint {
  return BigInt(`0x${hex}`);
}

/**
 * Extract key phrases for quick comparison
 */
export function extractKeyPhrases(text: string, maxPhrases: number = 10): string[] {
  // Simple extraction based on frequency
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(w => w.length > 4); // Only words longer than 4 chars

  // Count word frequency
  const freq = new Map<string, number>();
  for (const word of words) {
    freq.set(word, (freq.get(word) || 0) + 1);
  }

  // Sort by frequency and return top phrases
  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPhrases)
    .map(([word]) => word);
}

/**
 * Quick duplicate check using key phrases
 */
export function quickDuplicateCheck(
  phrases1: string[],
  phrases2: string[],
  threshold: number = 0.7
): boolean {
  const set1 = new Set(phrases1);
  const set2 = new Set(phrases2);

  const intersection = phrases1.filter(p => set2.has(p)).length;
  const union = new Set([...phrases1, ...phrases2]).size;

  const jaccardSimilarity = intersection / union;
  return jaccardSimilarity >= threshold;
}
