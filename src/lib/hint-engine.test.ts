import { describe, expect, it } from 'vitest';
import {
    HintLevel,
    type HintGameState,
    getHint,
} from './hint-engine.js';

describe('getHint', () => {
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
            expect([hint.leftValue, hint.rightValue]).toEqual(
                expect.arrayContaining([5, 50])
            );
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
            // Verify the final step reaches the target
            const lastStep = hint.steps[hint.steps.length - 1];
            expect(lastStep.result).toBe(175);
        }
    });

    it('correctly includes duplicate values from completed steps', () => {
        // After completing 75 - 50 = 25, we have two 25s available
        // (the original 25 from starting numbers, and the result 25)
        const state: HintGameState = {
            availableNumbers: [1, 5, 7, 9, 50, 75, 25],
            completedSteps: [{ id: 'step-1', left: 75, operator: '-', right: 50, value: 25 }],
            target: 175, // A solvable target
        };

        const hint = getHint(state, HintLevel.FullSolution);
        // Should find a solution (doesn't matter if 25+25 is in it)
        expect(hint).not.toBeNull();
        if (hint?.level === HintLevel.FullSolution) {
            // The solution should reach the target
            const lastStep = hint.steps[hint.steps.length - 1];
            expect(lastStep.result).toBe(175);
        }
    });
});





