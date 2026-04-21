/**
 * @purpose Core solver engine for the Numbers game.
 *
 * Provides exhaustive backtracking search with memoization to find valid solution paths
 * from a set of starting numbers to a target value using +, -, ×, ÷ operators.
 */

import type { Operator, StepData } from '../types.js';

/**
 * Represents an available token in the solver state.
 * Uses an internal id to distinguish tokens by identity, not just value.
 */
interface SolverToken {
    id: string;
    value: number;
}

/**
 * Represents a single equation in a solution path.
 * Mirrors StepData but may be used with internal token ids.
 */
interface SolverStep {
    id: string;
    left: number;
    operator: Operator;
    right: number;
    value: number;
}

/**
 * Result of a solve attempt.
 * If found, contains the list of steps needed to reach the target.
 */
export interface SolverResult {
    found: boolean;
    steps: SolverStep[];
}

/**
 * Evaluates an expression with the given operands and operator.
 * Returns the result if valid (positive integer), or null if invalid.
 *
 * Valid means:
 * - Subtraction produces a positive result (> 0, i.e., left > right)
 * - Division produces an integer result (no remainder)
 */
const evaluate = (left: number, operator: Operator, right: number): number | null => {
    switch (operator) {
        case '+':
            return left + right;
        case '×':
            return left * right;
        case '-':
            return left > right ? left - right : null;
        case '÷':
            return right !== 0 && left % right === 0 ? left / right : null;
        default:
            return null;
    }
};

/**
 * Generates a canonical memoization key for a set of tokens.
 * Tokens are sorted by value (ascending) then id to create a unique, consistent key.
 */
const getMemoKey = (tokens: SolverToken[]): string => {
    const sorted = [...tokens].sort((a, b) => (a.value !== b.value ? a.value - b.value : a.id.localeCompare(b.id)));
    return JSON.stringify(sorted.map((t) => ({ v: t.value, id: t.id })));
};

/**
 * Core backtracking solver.
 * Exhaustively searches for any valid step sequence that produces the target value.
 *
 * @param tokens Available tokens (each with unique id and numeric value)
 * @param target The goal value to reach
 * @param memo Memoization cache of explored token configurations
 * @param stepCounter Running counter for step ids
 * @param history Accumulated steps in the current solution path
 * @returns A solution if found; null otherwise
 */
const backtrack = (
    tokens: SolverToken[],
    target: number,
    memo: Map<string, boolean>,
    stepCounter: { count: number },
    history: SolverStep[]
): SolverStep[] | null => {
    // Check if we've already explored this token configuration
    const key = getMemoKey(tokens);
    if (memo.has(key)) {
        return null;
    }
    memo.set(key, true);

    // Base case: if only one token remains, check if it equals the target
    if (tokens.length === 1 && tokens[0].value === target) {
        return history;
    }

    // Recursive case: try all pairs of tokens and all operators
    // Sort pairs by combined value (larger pairs first) for better hint ordering
    const pairs: Array<[number, number, SolverToken, SolverToken]> = [];
    for (let i = 0; i < tokens.length; i += 1) {
        for (let j = 0; j < tokens.length; j += 1) {
            if (i === j) continue; // Can't use the same token twice
            pairs.push([i, j, tokens[i], tokens[j]]);
        }
    }
    // Sort by combined value descending (larger numbers first) for more useful hints
    pairs.sort((a, b) => (b[2].value + b[3].value) - (a[2].value + a[3].value));

    for (const [i, j, left, right] of pairs) {
        const operators: Operator[] = ['+', '-', '×', '÷'];

        for (const operator of operators) {
            const resultValue = evaluate(left.value, operator, right.value);
            if (resultValue === null) continue; // Invalid operation

            // If result equals target, we found a solution
            if (resultValue === target) {
                const solveStep: SolverStep = {
                    id: `step-${++stepCounter.count}`,
                    left: left.value,
                    operator,
                    right: right.value,
                    value: resultValue,
                };
                return [...history, solveStep];
            }

            // Otherwise, create a new state and recurse
            const newTokens = tokens.filter((_, idx) => idx !== i && idx !== j);
            const newToken: SolverToken = {
                id: `result-${stepCounter.count + 1}`,
                value: resultValue,
            };
            newTokens.push(newToken);

            const solveStep: SolverStep = {
                id: `step-${++stepCounter.count}`,
                left: left.value,
                operator,
                right: right.value,
                value: resultValue,
            };

            const solution = backtrack(newTokens, target, memo, stepCounter, [...history, solveStep]);
            if (solution) {
                return solution;
            }
        }
    }

    return null;
};

/**
 * Finds a valid solution path from starting numbers to target.
 *
 * @param numbers Array of starting numbers (typically 6 values)
 * @param target The goal value
 * @returns A SolverResult with found flag and steps if a solution exists
 */
export const findSolution = (numbers: number[], target: number): SolverResult => {
    // Check if the target is already in the starting numbers
    if (numbers.includes(target)) {
        return {
            found: true,
            steps: [],
        };
    }

    // Convert starting numbers to solver tokens with unique ids
    const tokens: SolverToken[] = numbers.map((value, index) => ({
        id: `n${index + 1}`,
        value,
    }));

    const memo = new Map<string, boolean>();
    const stepCounter = { count: 0 };

    const steps = backtrack(tokens, target, memo, stepCounter, []);

    return {
        found: steps !== null,
        steps: steps ?? [],
    };
};

/**
 * Checks if a given numbers/target pair is solvable.
 *
 * @param numbers Array of starting numbers
 * @param target The goal value
 * @returns true if a valid solution path exists; false otherwise
 */
export const isSolvable = (numbers: number[], target: number): boolean => {
    const result = findSolution(numbers, target);
    return result.found;
};


