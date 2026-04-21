/**
 * @purpose Hint engine for the Numbers game.
 *
 * Generates contextual hints by solving the current game state and providing
 * progressive guidance: from "next operands" to "next operator" to "full next step".
 */

import { findSolution, type SolverResult } from './solver.js';
import type { Operator, StepData } from '../types.js';

/**
 * Represents the current state of the game for hint generation.
 */
export interface HintGameState {
    availableNumbers: number[];
    completedSteps: StepData[];
    target: number;
}

/**
 * Hint level enumeration.
 */
export enum HintLevel {
    /** Suggest which two numbers can be used next */
    NextOperands = 'operands',
    /** Suggest which operator to use with the selected operands */
    NextOperator = 'operator',
    /** Provide the complete next step */
    NextStep = 'step',
    /** Reveal the entire solution path */
    FullSolution = 'solution',
}

/**
 * Hint payload for "next operands" level.
 */
export interface OperandsHint {
    level: HintLevel.NextOperands;
    leftValue: number;
    rightValue: number;
}

/**
 * Hint payload for "next operator" level.
 */
export interface OperatorHint {
    level: HintLevel.NextOperator;
    leftValue: number;
    operator: Operator;
    rightValue: number;
}

/**
 * Hint payload for "next step" level.
 */
export interface StepHint {
    level: HintLevel.NextStep;
    step: {
        left: number;
        operator: Operator;
        right: number;
        result: number;
    };
}

/**
 * Hint payload for "full solution" level.
 */
export interface SolutionHint {
    level: HintLevel.FullSolution;
    steps: Array<{
        left: number;
        operator: Operator;
        right: number;
        result: number;
    }>;
}

export type Hint = OperandsHint | OperatorHint | StepHint | SolutionHint;

/**
 * Generates a hint for the current game state at the specified level.
 *
 * @param gameState Current game state (available numbers, completed steps, target)
 * @param level Hint detail level
 * @returns A hint object, or null if no solution exists or hint cannot be generated
 */
export const getHint = (gameState: HintGameState, level: HintLevel): Hint | null => {
    // Reconstruct available tokens by:
    // 1. Starting with available numbers
    // 2. Adding results from completed steps that haven't been used yet
    const availableValues = [...gameState.availableNumbers];

    for (const step of gameState.completedSteps) {
        availableValues.push(step.value);
    }

    // Solve from the current state
    const solverResult = findSolution(availableValues, gameState.target);
    if (!solverResult.found) {
        return null;
    }

    // If requesting full solution, return it immediately
    if (level === HintLevel.FullSolution) {
        return {
            level: HintLevel.FullSolution,
            steps: solverResult.steps.map((s) => ({
                left: s.left,
                operator: s.operator,
                right: s.right,
                result: s.value,
            })),
        };
    }

    // Extract the first step from the solution
    const nextStep = solverResult.steps[0];
    if (!nextStep) {
        return null;
    }

    // Return appropriate hint based on level
    switch (level) {
        case HintLevel.NextOperands:
            return {
                level: HintLevel.NextOperands,
                leftValue: nextStep.left,
                rightValue: nextStep.right,
            };

        case HintLevel.NextOperator:
            return {
                level: HintLevel.NextOperator,
                leftValue: nextStep.left,
                operator: nextStep.operator,
                rightValue: nextStep.right,
            };

        case HintLevel.NextStep:
            return {
                level: HintLevel.NextStep,
                step: {
                    left: nextStep.left,
                    operator: nextStep.operator,
                    right: nextStep.right,
                    result: nextStep.value,
                },
            };

        default:
            return null;
    }
};

