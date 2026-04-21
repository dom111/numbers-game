import { afterEach, describe, expect, it } from 'vitest';
import {
    clearSolvabilityCache,
    getSolvabilityCacheSize,
    validateSolvability,
} from './validator.js';

describe('validateSolvability', () => {
    afterEach(() => {
        clearSolvabilityCache();
    });

    it('returns true for a solvable case', () => {
        expect(validateSolvability([5, 50], 250)).toBe(true);
    });

    it('returns false for an unsolvable case', () => {
        expect(validateSolvability([2, 3], 7)).toBe(false);
    });

    it('returns true for a standard Countdown example', () => {
        expect(validateSolvability([1, 5, 7, 9, 50, 75], 175)).toBe(true);
    });

    it('returns true when target is in the starting numbers', () => {
        expect(validateSolvability([1, 5, 7, 9, 50, 75], 50)).toBe(true);
    });

    it('caches results and returns the same value on subsequent calls', () => {
        const result1 = validateSolvability([1, 5, 7, 9, 50, 75], 175);
        const result2 = validateSolvability([1, 5, 7, 9, 50, 75], 175);

        expect(result1).toBe(result2);
        expect(result1).toBe(true);
    });

    it('uses cache size to avoid recomputation', () => {
        expect(getSolvabilityCacheSize()).toBe(0);

        validateSolvability([1, 5, 7, 9, 50, 75], 175);
        expect(getSolvabilityCacheSize()).toBe(1);

        validateSolvability([1, 5, 7, 9, 50, 75], 175);
        expect(getSolvabilityCacheSize()).toBe(1); // No new entry
    });

    it('skips cache when useCache is false', () => {
        validateSolvability([1, 5, 7, 9, 50, 75], 175, true);
        expect(getSolvabilityCacheSize()).toBe(1);

        validateSolvability([1, 5, 7, 9, 50, 75], 175, false);
        expect(getSolvabilityCacheSize()).toBe(1); // Cache not updated
    });

    it('clears the cache on demand', () => {
        validateSolvability([1, 5, 7, 9, 50, 75], 175);
        validateSolvability([5, 50], 250);
        expect(getSolvabilityCacheSize()).toBe(2);

        clearSolvabilityCache();
        expect(getSolvabilityCacheSize()).toBe(0);
    });

    it('treats reordered numbers as the same case (canonical key)', () => {
        // [1, 5, 7, 9, 50, 75] and [75, 50, 9, 7, 5, 1] should map to the same cache key
        const result1 = validateSolvability([1, 5, 7, 9, 50, 75], 175);
        const initialCacheSize = getSolvabilityCacheSize();

        const result2 = validateSolvability([75, 50, 9, 7, 5, 1], 175);
        const finalCacheSize = getSolvabilityCacheSize();

        expect(result1).toBe(result2);
        expect(finalCacheSize).toBe(initialCacheSize); // No new cache entry
    });
});

