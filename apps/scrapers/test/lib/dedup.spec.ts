/**
 * Tests for article deduplication
 */

import { describe, it, expect } from 'vitest';
import {
  generateShingles,
  calculateSimHash,
  hammingDistance,
  similarityScore,
  isDuplicate,
  areTextsDuplicate,
  findDuplicates,
  hashToHex,
  hexToHash,
  extractKeyPhrases,
  quickDuplicateCheck,
} from '../../src/lib/dedup';

describe('Deduplication Utilities', () => {
  describe('generateShingles', () => {
    it('should generate n-grams from text', () => {
      const text = 'the quick brown fox jumps over the lazy dog';
      const shingles = generateShingles(text, 3);

      expect(shingles).toContain('the quick brown');
      expect(shingles).toContain('quick brown fox');
      expect(shingles.length).toBe(7); // 9 words - 3 + 1 = 7 shingles
    });

    it('should normalize text before shingling', () => {
      const text = 'The QUICK Brown, FOX!';
      const shingles = generateShingles(text, 2);

      expect(shingles).toContain('the quick');
      expect(shingles).toContain('quick brown');
    });

    it('should handle short texts', () => {
      const text = 'one two';
      const shingles = generateShingles(text, 3);

      expect(shingles).toEqual([]);
    });
  });

  describe('calculateSimHash', () => {
    it('should return a bigint hash', () => {
      const text = 'this is a test article about politics';
      const hash = calculateSimHash(text);

      expect(typeof hash).toBe('bigint');
    });

    it('should return similar hashes for similar texts', () => {
      const text1 = 'The president announced new policies today in Washington';
      const text2 = 'The president announced new policies today in Washington DC';

      const hash1 = calculateSimHash(text1);
      const hash2 = calculateSimHash(text2);

      const distance = hammingDistance(hash1, hash2);
      expect(distance).toBeLessThan(20); // Should be similar
    });

    it('should return different hashes for different texts', () => {
      const text1 = 'The president announced new policies today';
      const text2 = 'The weather forecast predicts rain tomorrow';

      const hash1 = calculateSimHash(text1);
      const hash2 = calculateSimHash(text2);

      const distance = hammingDistance(hash1, hash2);
      expect(distance).toBeGreaterThan(20); // Should be different
    });
  });

  describe('hammingDistance', () => {
    it('should return 0 for identical hashes', () => {
      const hash = BigInt('0x123456789abcdef0');
      expect(hammingDistance(hash, hash)).toBe(0);
    });

    it('should count differing bits', () => {
      const hash1 = BigInt(0b1010);
      const hash2 = BigInt(0b1001);
      expect(hammingDistance(hash1, hash2)).toBe(2);
    });
  });

  describe('similarityScore', () => {
    it('should return 1.0 for identical hashes', () => {
      const hash = BigInt('0x123456789abcdef0');
      expect(similarityScore(hash, hash)).toBe(1.0);
    });

    it('should return lower scores for different hashes', () => {
      const hash1 = BigInt('0xFFFFFFFFFFFFFFFF');
      const hash2 = BigInt('0x0000000000000000');
      const score = similarityScore(hash1, hash2);
      expect(score).toBe(0); // Completely different
    });
  });

  describe('isDuplicate', () => {
    it('should detect duplicates', () => {
      const text = 'The quick brown fox jumps over the lazy dog near the river';
      const hash1 = calculateSimHash(text);
      const hash2 = calculateSimHash(text + ' extra word');

      expect(isDuplicate(hash1, hash2)).toBe(true);
    });

    it('should not flag different content as duplicates', () => {
      const text1 = 'Politics and government in the United States today';
      const text2 = 'Sports and entertainment news from around the world';

      const hash1 = calculateSimHash(text1);
      const hash2 = calculateSimHash(text2);

      expect(isDuplicate(hash1, hash2)).toBe(false);
    });
  });

  describe('findDuplicates', () => {
    it('should find duplicate articles in a list', () => {
      const articles = [
        { id: 1, content: 'The president announced new policies today in Washington' },
        { id: 2, content: 'Weather forecast predicts rain tomorrow in New York' },
        { id: 3, content: 'The president announced new policies today in Washington DC' },
      ];

      const duplicates = findDuplicates(articles);

      expect(duplicates.length).toBeGreaterThan(0);
      expect(duplicates[0].originalId).toBe(1);
      expect(duplicates[0].duplicateId).toBe(3);
    });

    it('should return empty array when no duplicates', () => {
      const articles = [
        { id: 1, content: 'Politics and government news from Washington' },
        { id: 2, content: 'Sports results from the weekend games' },
        { id: 3, content: 'Technology trends in artificial intelligence' },
      ];

      const duplicates = findDuplicates(articles);
      expect(duplicates.length).toBe(0);
    });
  });

  describe('hash conversion', () => {
    it('should convert hash to hex and back', () => {
      const original = BigInt('0x123456789abcdef0');
      const hex = hashToHex(original);
      const converted = hexToHash(hex);

      expect(converted).toBe(original);
    });
  });

  describe('extractKeyPhrases', () => {
    it('should extract frequent words', () => {
      const text = 'president president government policy policy policy economy';
      const phrases = extractKeyPhrases(text, 3);

      expect(phrases).toContain('policy');
      expect(phrases).toContain('president');
    });
  });

  describe('quickDuplicateCheck', () => {
    it('should detect similar phrase sets', () => {
      const phrases1 = ['president', 'policy', 'government', 'washington'];
      const phrases2 = ['president', 'policy', 'government', 'congress'];

      expect(quickDuplicateCheck(phrases1, phrases2)).toBe(true);
    });

    it('should reject dissimilar phrase sets', () => {
      const phrases1 = ['president', 'policy', 'government'];
      const phrases2 = ['sports', 'football', 'championship'];

      expect(quickDuplicateCheck(phrases1, phrases2)).toBe(false);
    });
  });
});
