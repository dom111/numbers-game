/**
 * @purpose Daily puzzle generation using a deterministic, date-seeded PRNG.
 *
 * The same UTC date always produces the same puzzle for a given difficulty,
 * regardless of the user's locale or timezone.
 *
 * Algorithm:
 * - Seed = djb2 hash of `YYYY-MM-DD:difficulty`
 * - PRNG = Mulberry32 (well-distributed 32-bit generator, pure arithmetic, no state drift)
 * - Numbers drawn without replacement from the standard pool using seeded PRNG
 * - Target generated from seeded PRNG within 1–999 range
 * - Puzzle validated against difficulty band; seeded retry loop if needed
 */

import type { GameDifficulty } from '../types.js';
import { findSolution } from './solver.js';
import { isInDifficultyBand } from './difficulty.js';

const NUMBER_POOL = [25, 50, 75, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const MAX_DAILY_ATTEMPTS = 500;

/**
 * Returns today's UTC date as a locale-independent `YYYY-MM-DD` string.
 * Uses ISO 8601 format (first 10 chars of `toISOString()`) — always UTC.
 */
export const getDailyDateKey = (): string => new Date().toISOString().slice(0, 10);

/**
 * Derives a deterministic 32-bit integer seed from a date key and difficulty.
 * Uses the djb2 hash algorithm over ASCII codepoints.
 */
export const getDailySeed = (dateKey: string, difficulty: GameDifficulty): number => {
    const input = `${dateKey}:${difficulty}`;
    let hash = 5381;
    for (let i = 0; i < input.length; i++) {
        // djb2: hash = hash * 33 ^ char
        hash = ((hash << 5) + hash) ^ input.charCodeAt(i);
        hash = hash >>> 0; // keep 32-bit unsigned
    }
    return hash;
};

/**
 * Mulberry32 — a fast, high-quality 32-bit PRNG.
 * Returns a factory that produces one float in [0, 1) per call.
 *
 * @param seed - 32-bit unsigned integer seed
 */
export const mulberry32 = (seed: number): (() => number) => {
    let s = seed >>> 0;
    return () => {
        s += 0x6d2b79f5;
        let t = s;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
    };
};

/**
 * Generates six numbers by drawing without replacement from the standard pool,
 * using the provided PRNG instead of `Math.random`.
 */
const generateNumbersSeeded = (rand: () => number): number[] => {
    const remaining = [...NUMBER_POOL];
    const picks: number[] = [];
    for (let i = 0; i < 6; i++) {
        const index = Math.floor(rand() * remaining.length);
        const [picked] = remaining.splice(index, 1);
        picks.push(picked);
    }
    return picks;
};

/**
 * Generates a target in the range 1–999 using the provided PRNG.
 */
const generateTargetSeeded = (rand: () => number): number => Math.floor(rand() * 999) + 1;

/**
 * Generates a fully deterministic daily puzzle for the given difficulty and date key.
 *
 * Retries within the seeded sequence until a puzzle in the correct difficulty band is
 * found, or falls back to the best solvable candidate after `MAX_DAILY_ATTEMPTS`.
 *
 * @param difficulty - 'easy' or 'normal'
 * @param dateKey    - `YYYY-MM-DD` UTC date string; defaults to today
 */
export const generateDailyRound = (
    difficulty: GameDifficulty,
    dateKey: string = getDailyDateKey()
): { numbers: number[]; target: number; dateKey: string } => {
    const seed = getDailySeed(dateKey, difficulty);
    const rand = mulberry32(seed);

    let bestCandidate: { numbers: number[]; target: number; stepCount: number } | null = null;

    for (let attempt = 0; attempt < MAX_DAILY_ATTEMPTS; attempt++) {
        const numbers = generateNumbersSeeded(rand);
        const target = generateTargetSeeded(rand);
        const solution = findSolution(numbers, target);

        if (!solution.found) continue;

        const stepCount = solution.steps.length;

        if (isInDifficultyBand(difficulty, stepCount)) {
            return { numbers, target, dateKey };
        }

        // Track best out-of-band candidate as fallback.
        if (difficulty === 'easy') {
            if (!bestCandidate || stepCount < bestCandidate.stepCount) {
                bestCandidate = { numbers: [...numbers], target, stepCount };
            }
        } else {
            if (!bestCandidate || stepCount > bestCandidate.stepCount) {
                bestCandidate = { numbers: [...numbers], target, stepCount };
            }
        }
    }

    if (bestCandidate) {
        console.warn('[numbers-game] Daily puzzle band exhausted; using best solvable candidate.', {
            dateKey,
            difficulty,
            bestStepCount: bestCandidate.stepCount,
        });
        return { numbers: bestCandidate.numbers, target: bestCandidate.target, dateKey };
    }

    // Hard fallback: guaranteed solvable (sum of first two picks).
    const fallbackNumbers = generateNumbersSeeded(rand);
    const fallbackTarget = fallbackNumbers[0] + fallbackNumbers[1];
    console.warn('[numbers-game] Daily puzzle: using guaranteed-solvable fallback.', {
        dateKey,
        difficulty,
    });
    return { numbers: fallbackNumbers, target: fallbackTarget, dateKey };
};
