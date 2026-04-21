/**
 * @purpose Core solver engine for the Numbers game.
 *
 * Provides a shortest-path solver that prefers simpler arithmetic when multiple
 * solutions use the same number of steps.
 */

import type { Operator } from '../types.js';

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
 */
export interface SolverStep {
    id: string;
    left: number;
    operator: Operator;
    right: number;
    value: number;
}

type SolverState = {
    tokens: SolverToken[];
    steps: SolverStep[];
};

type CandidateMove = {
    tokens: SolverToken[];
    step: SolverStep;
    heuristic: [number, number, number, number];
};

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
 * Generates a canonical state key for a set of tokens.
 * Token identity does not matter for solving; only the multiset of values matters.
 */
const getStateKey = (tokens: SolverToken[]): string =>
    [...tokens]
        .map((token) => token.value)
        .sort((a, b) => a - b)
        .join(',');

const compareHeuristic = (
    left: [number, number, number, number],
    right: [number, number, number, number]
): number => {
    for (let index = 0; index < left.length; index += 1) {
        if (left[index] !== right[index]) {
            return left[index] - right[index];
        }
    }
    return 0;
};

const scorePath = (steps: SolverStep[]): [number, number, number, number] => {
    if (steps.length === 0) {
        return [0, 0, 0, 0];
    }

    const maxIntermediate = Math.max(...steps.map((step) => step.value));
    const divisionCount = steps.filter((step) => step.operator === '÷').length;
    const multiplicationCount = steps.filter((step) => step.operator === '×').length;
    const sumIntermediate = steps.reduce((sum, step) => sum + step.value, 0);

    return [maxIntermediate, divisionCount, multiplicationCount, sumIntermediate];
};

const operatorWeight = (operator: Operator): number => {
    switch (operator) {
        case '-':
            return 0;
        case '+':
            return 1;
        case '×':
            return 2;
        case '÷':
            return 3;
        default:
            return 4;
    }
};

const shouldSkipOperation = (left: number, operator: Operator, right: number): boolean => {
    if (operator === '×' && (left === 1 || right === 1)) {
        return true;
    }

    if (operator === '÷' && right === 1) {
        return true;
    }

    return false;
};

const createStep = (
    left: number,
    operator: Operator,
    right: number,
    value: number,
    stepNumber: number
): SolverStep => ({
    id: `step-${stepNumber}`,
    left,
    operator,
    right,
    value,
});

const createCandidateMoves = (
    tokens: SolverToken[],
    target: number,
    nextStepNumber: number
): CandidateMove[] => {
    const moves: CandidateMove[] = [];

    const addMove = (
        firstIndex: number,
        secondIndex: number,
        left: number,
        operator: Operator,
        right: number
    ): void => {
        if (shouldSkipOperation(left, operator, right)) {
            return;
        }

        const value = evaluate(left, operator, right);
        if (value === null) return;

        const nextTokens = tokens.filter(
            (_, index) => index !== firstIndex && index !== secondIndex
        );
        nextTokens.push({
            id: `r-${nextStepNumber}-${firstIndex}-${secondIndex}-${operator}`,
            value,
        });

        const nextValues = nextTokens.map((token) => token.value);
        const maxToken = Math.max(...nextValues);
        const distanceToTarget = Math.abs(target - value);

        moves.push({
            tokens: nextTokens,
            step: createStep(left, operator, right, value, nextStepNumber),
            heuristic: [maxToken, distanceToTarget, operatorWeight(operator), value],
        });
    };

    for (let firstIndex = 0; firstIndex < tokens.length; firstIndex += 1) {
        for (let secondIndex = firstIndex + 1; secondIndex < tokens.length; secondIndex += 1) {
            const first = tokens[firstIndex];
            const second = tokens[secondIndex];

            addMove(firstIndex, secondIndex, first.value, '+', second.value);
            addMove(firstIndex, secondIndex, first.value, '×', second.value);

            if (first.value > second.value) {
                addMove(firstIndex, secondIndex, first.value, '-', second.value);
            } else if (second.value > first.value) {
                addMove(firstIndex, secondIndex, second.value, '-', first.value);
            }

            if (second.value !== 0 && first.value % second.value === 0) {
                addMove(firstIndex, secondIndex, first.value, '÷', second.value);
            }

            if (
                first.value !== second.value &&
                first.value !== 0 &&
                second.value % first.value === 0
            ) {
                addMove(firstIndex, secondIndex, second.value, '÷', first.value);
            }
        }
    }

    moves.sort((left, right) => compareHeuristic(left.heuristic, right.heuristic));
    return moves;
};

/**
 * Returns the shortest human-friendly solution path for the provided tokens.
 * Breadth-first search guarantees the fewest steps; move ordering then prefers
 * smaller intermediate values and simpler operators within that shortest depth.
 */
const findShortestSolution = (tokens: SolverToken[], target: number): SolverStep[] | null => {
    const bestStateVisit = new Map<
        string,
        { depth: number; score: [number, number, number, number] }
    >();
    bestStateVisit.set(getStateKey(tokens), { depth: 0, score: [0, 0, 0, 0] });
    const queue: SolverState[] = [{ tokens, steps: [] }];
    let bestSolution: SolverStep[] | null = null;
    let bestScore: [number, number, number, number] | null = null;

    for (let index = 0; index < queue.length; index += 1) {
        const state = queue[index];

        // Once a shortest solution is found, only expand states that can still
        // produce solutions of equal depth.
        if (bestSolution && state.steps.length >= bestSolution.length) {
            break;
        }

        const moves = createCandidateMoves(state.tokens, target, state.steps.length + 1);

        for (const move of moves) {
            const nextSteps = [...state.steps, move.step];

            if (bestSolution && nextSteps.length > bestSolution.length) {
                continue;
            }

            if (move.step.value === target) {
                const score = scorePath(nextSteps);
                if (!bestSolution || !bestScore || compareHeuristic(score, bestScore) < 0) {
                    bestSolution = nextSteps;
                    bestScore = score;
                }
                continue;
            }

            const key = getStateKey(move.tokens);
            const nextDepth = nextSteps.length;
            const nextScore = scorePath(nextSteps);
            const previousVisit = bestStateVisit.get(key);

            const shouldVisit =
                !previousVisit ||
                nextDepth < previousVisit.depth ||
                (nextDepth === previousVisit.depth &&
                    compareHeuristic(nextScore, previousVisit.score) < 0);

            if (!shouldVisit) {
                continue;
            }

            bestStateVisit.set(key, { depth: nextDepth, score: nextScore });
            queue.push({ tokens: move.tokens, steps: nextSteps });
        }
    }

    return bestSolution;
};

/**
 * Finds a valid solution path from starting numbers to target.
 *
 * @param numbers Array of starting numbers (typically 6 values)
 * @param target The goal value
 * @returns A SolverResult with found flag and steps if a solution exists
 */
export const findSolution = (numbers: number[], target: number): SolverResult => {
    // Convert starting numbers to solver tokens with unique ids
    const tokens: SolverToken[] = numbers.map((value, index) => ({
        id: `n${index + 1}`,
        value,
    }));

    const steps = findShortestSolution(tokens, target);

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
    return findSolution(numbers, target).found;
};
