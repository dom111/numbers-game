import { describe, expect, it } from 'vitest';
import { HintLevel, type HintGameState, getHint } from './hint-engine.js';

describe('getHint', () => {
    const countByValue = (values: number[]): Map<number, number> => {
        const counts = new Map<number, number>();
        for (const value of values) {
            counts.set(value, (counts.get(value) ?? 0) + 1);
        }
        return counts;
    };

    const baseState: HintGameState = {
        availableNumbers: [1, 5, 7, 9, 50, 75],
        completedSteps: [],
        target: 175,
    };

    it('returns null for an unsolvable state', () => {
        const unsolvableState: HintGameState = {
            availableNumbers: [2, 3],
            completedSteps: [],
            target: 7,
        };

        expect(getHint(unsolvableState, HintLevel.NextOperands)).toBeNull();
        expect(getHint(unsolvableState, HintLevel.NextStep)).toBeNull();
    });

    it('returns NextOperands hint with two numbers to combine', () => {
        const state: HintGameState = {
            availableNumbers: [5, 50],
            completedSteps: [],
            target: 250,
        };

        const hint = getHint(state, HintLevel.NextOperands);
        expect(hint).not.toBeNull();
        expect(hint?.level).toBe(HintLevel.NextOperands);

        if (hint?.level === HintLevel.NextOperands) {
            expect([hint.leftValue, hint.rightValue]).toEqual(expect.arrayContaining([5, 50]));
        }
    });

    it('returns NextOperator hint with operator filled in', () => {
        const state: HintGameState = {
            availableNumbers: [5, 50],
            completedSteps: [],
            target: 250,
        };

        const hint = getHint(state, HintLevel.NextOperator);
        expect(hint).not.toBeNull();
        expect(hint?.level).toBe(HintLevel.NextOperator);

        if (hint?.level === HintLevel.NextOperator) {
            expect(hint.operator).toBe('×');
        }
    });

    it('returns NextStep hint with complete first step', () => {
        const state: HintGameState = {
            availableNumbers: [5, 50, 75],
            completedSteps: [],
            target: 175,
        };

        const hint = getHint(state, HintLevel.NextStep);
        expect(hint).not.toBeNull();
        expect(hint?.level).toBe(HintLevel.NextStep);

        if (hint?.level === HintLevel.NextStep) {
            expect(hint.step.result).toBe(250); // 5 × 50
        }
    });

    it('returns FullSolution hint with all steps', () => {
        const state: HintGameState = {
            availableNumbers: [5, 50, 75],
            completedSteps: [],
            target: 175,
        };

        const hint = getHint(state, HintLevel.FullSolution);
        expect(hint).not.toBeNull();
        expect(hint?.level).toBe(HintLevel.FullSolution);

        if (hint?.level === HintLevel.FullSolution) {
            expect(hint.steps.length).toBeGreaterThan(0);
            expect(hint.steps[hint.steps.length - 1].result).toBe(175);
        }
    });

    it('includes completed step results in available tokens for hint generation', () => {
        const state: HintGameState = {
            availableNumbers: [1, 5, 7, 9, 50, 75],
            completedSteps: [{ id: 'step-1', left: 5, operator: '×', right: 50, value: 250 }],
            target: 175,
        };

        // After step-1, the solver should find a path that uses the 250 result
        const hint = getHint(state, HintLevel.FullSolution);
        expect(hint).not.toBeNull();

        if (hint?.level === HintLevel.FullSolution) {
            // The solution should reach the target
            const lastStep = hint.steps[hint.steps.length - 1];
            expect(lastStep.result).toBe(175);
        }
    });

    it('returns correct hint for standard Countdown example', () => {
        const hint = getHint(baseState, HintLevel.NextStep);
        expect(hint).not.toBeNull();
        expect(hint?.level).toBe(HintLevel.NextStep);

        if (hint?.level === HintLevel.NextStep) {
            expect([25, 250]).toContain(hint.step.result);
            expect(hint.step.operator).not.toBe('+');
        }
    });

    it('generates different hints for different levels on same state', () => {
        const state: HintGameState = {
            availableNumbers: [5, 50],
            completedSteps: [],
            target: 250,
        };

        const operandsHint = getHint(state, HintLevel.NextOperands);
        const operatorHint = getHint(state, HintLevel.NextOperator);
        const stepHint = getHint(state, HintLevel.NextStep);

        expect(operandsHint?.level).toBe(HintLevel.NextOperands);
        expect(operatorHint?.level).toBe(HintLevel.NextOperator);
        expect(stepHint?.level).toBe(HintLevel.NextStep);
    });

    it('returns full solution with multiple steps', () => {
        const state: HintGameState = {
            availableNumbers: [1, 5, 7, 9, 50, 75],
            completedSteps: [],
            target: 175,
        };

        const hint = getHint(state, HintLevel.FullSolution);
        expect(hint?.level).toBe(HintLevel.FullSolution);

        if (hint?.level === HintLevel.FullSolution) {
            expect(hint.steps).toHaveLength(2);
            // Verify the final step reaches the target
            const lastStep = hint.steps[hint.steps.length - 1];
            expect(lastStep.result).toBe(175);
        }
    });

    it('uses only currently available numbers after 75 - 50 = 25', () => {
        const availableNumbers = [1, 5, 7, 9, 25];
        const state: HintGameState = {
            availableNumbers,
            completedSteps: [{ id: 'step-1', left: 75, operator: '-', right: 50, value: 25 }],
            target: 175,
        };

        const hint = getHint(state, HintLevel.NextOperands);
        expect(hint).not.toBeNull();

        if (hint?.level === HintLevel.NextOperands) {
            const hintValues = [hint.leftValue, hint.rightValue];
            const availableCounts = countByValue(availableNumbers);
            const hintCounts = countByValue(hintValues);

            for (const [value, count] of hintCounts) {
                expect(count).toBeLessThanOrEqual(availableCounts.get(value) ?? 0);
            }

            expect(hintValues).not.toEqual([25, 25]);
            expect(hintValues.every((value) => availableNumbers.includes(value))).toBe(true);
        }
    });
});
