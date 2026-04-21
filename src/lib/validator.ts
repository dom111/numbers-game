/**
 * @purpose Solution validator for the Numbers game.
 *
 * Validates that a given numbers/target pair has at least one valid solution
 * before starting a round. Uses the core solver engine with optional caching.
 */

import { isSolvable } from './solver.js';

/**
 * Cache for solvability results to avoid redundant solver invocations.
 * Keyed by a canonical representation of numbers and target.
 */
const solvabilityCache = new Map<string, boolean>();

/**
 * Generates a cache key for a numbers/target pair.
 * Sorts numbers to ensure consistent keys regardless of order.
 */
const getCacheKey = (numbers: number[], target: number): string => {
    const sorted = [...numbers].sort((a, b) => a - b);
    return JSON.stringify({ numbers: sorted, target });
};

/**
 * Validates that a numbers/target pair is solvable.
 *
 * Uses memoization to cache results, avoiding expensive re-solves of identical
 * game states (useful if users retry with the same numbers/target).
 *
 * @param numbers Array of starting numbers
 * @param target The goal value
 * @param useCache Whether to use the memoization cache (default: true)
 * @returns true if at least one valid solution exists; false otherwise
 */
export const validateSolvability = (numbers: number[], target: number, useCache = true): boolean => {
    if (!useCache) {
        return isSolvable(numbers, target);
    }

    const key = getCacheKey(numbers, target);
    if (solvabilityCache.has(key)) {
        return solvabilityCache.get(key)!;
    }

    const result = isSolvable(numbers, target);
    solvabilityCache.set(key, result);
    return result;
};

/**
 * Clears the solvability cache.
 * Useful for testing or memory management in long-running applications.
 */
export const clearSolvabilityCache = (): void => {
    solvabilityCache.clear();
};

/**
 * Returns the current size of the solvability cache.
 * Useful for debugging and performance monitoring.
 */
export const getSolvabilityCacheSize = (): number => {
    return solvabilityCache.size;
};

