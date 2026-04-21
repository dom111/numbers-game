import { describe, expect, it } from 'vitest';
import { findSolution, isSolvable } from './solver.js';

describe('findSolution', () => {
    it('returns empty steps when target is already in the starting numbers', () => {
        const result = findSolution([1, 5, 7, 9, 50, 75], 50);
        expect(result.found).toBe(true);
        expect(result.steps).toHaveLength(0);
    });

    it('finds a solution for 5 × 50 = 250', () => {
        const result = findSolution([5, 50], 250);
        expect(result.found).toBe(true);
        expect(result.steps).toHaveLength(1);

        const step = result.steps[0];
        expect(step.value).toBe(250);
        expect(step.operator).toBe('×');
    });

    it('finds a two-step solution: 5 × 50 = 250, then 250 - 75 = 175', () => {
        const result = findSolution([5, 50, 75], 175);
        expect(result.found).toBe(true);
        expect(result.steps).toHaveLength(2);

        expect(result.steps[0].value).toBe(250);
        expect(result.steps[0].operator).toBe('×');

        expect(result.steps[1].value).toBe(175);
        expect(result.steps[1].operator).toBe('-');
    });

    it('finds a solution using addition: 1 + 5 + 7 = 13', () => {
        const result = findSolution([1, 5, 7], 13);
        expect(result.found).toBe(true);
        expect(result.steps.length).toBeGreaterThan(0);

        const finalStep = result.steps[result.steps.length - 1];
        expect(finalStep.value).toBe(13);
    });

    it('finds a solution using division: 100 ÷ 5 = 20', () => {
        const result = findSolution([100, 5], 20);
        expect(result.found).toBe(true);
        expect(result.steps).toHaveLength(1);

        const step = result.steps[0];
        expect(step.value).toBe(20);
        expect(step.operator).toBe('÷');
    });

    it('returns false for an unsolvable case', () => {
        // Impossible: 2 and 3 can only produce 5, 6 (2+3), 1 (3-2), or 2/3 (non-integer)
        const result = findSolution([2, 3], 7);
        expect(result.found).toBe(false);
        expect(result.steps).toHaveLength(0);
    });

    it('handles a standard Countdown example: [1, 5, 7, 9, 50, 75] → 175', () => {
        const result = findSolution([1, 5, 7, 9, 50, 75], 175);
        expect(result.found).toBe(true);
        expect(result.steps.length).toBeGreaterThan(0);

        const finalStep = result.steps[result.steps.length - 1];
        expect(finalStep.value).toBe(175);
    });

    it('avoids division by zero', () => {
        // Should not attempt to divide by zero
        const result = findSolution([1, 2], 1);
        expect(result.found).toBe(true);
    });

    it('respects subtraction constraint (left > right)', () => {
        // 5 - 10 is invalid, should not find a solution through that path
        const result = findSolution([5, 10], 5); // Only valid via direct match
        expect(result.found).toBe(true);
        expect(result.steps).toHaveLength(0); // Already in starting set
    });

    it('handles multi-step solutions with mixed operators', () => {
        // Example: [2, 3, 4] → 14
        // One path: 2 + 3 = 5, then 5 × 4 = 20 (no), or 3 × 4 = 12, then 12 + 2 = 14 ✓
        const result = findSolution([2, 3, 4], 14);
        expect(result.found).toBe(true);

        const finalStep = result.steps[result.steps.length - 1];
        expect(finalStep.value).toBe(14);
    });

    it('memoizes correctly to avoid exploring duplicate token sets', () => {
        // This test verifies behavior indirectly; a well-memoized solver
        // should complete quickly even on complex cases.
        const result = findSolution([2, 2, 2, 2, 2, 2], 12);
        expect(result.found).toBe(true);
    });
});

describe('isSolvable', () => {
    it('returns true for a solvable case', () => {
        expect(isSolvable([5, 50], 250)).toBe(true);
    });

    it('returns false for an unsolvable case', () => {
        // Impossible: 2 and 3 can only produce 5, 6 (2+3), 1 (3-2), or 2/3 (non-integer)
        expect(isSolvable([2, 3], 7)).toBe(false);
    });

    it('returns true when target is in the starting set', () => {
        expect(isSolvable([1, 5, 7, 9, 50, 75], 50)).toBe(true);
    });

    it('returns true for a standard Countdown example', () => {
        expect(isSolvable([1, 5, 7, 9, 50, 75], 175)).toBe(true);
    });
});



