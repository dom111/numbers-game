/**
 * @purpose Shared difficulty-band helpers used by game generation and daily puzzle logic.
 */

import type { GameDifficulty } from '../types.js';

export const EASY_MAX_STEPS = 3;
export const NORMAL_MIN_STEPS = 4;

/** Returns true when `stepCount` falls within the accepted band for `difficulty`. */
export const isInDifficultyBand = (difficulty: GameDifficulty, stepCount: number): boolean => {
    if (difficulty === 'easy') {
        return stepCount <= EASY_MAX_STEPS;
    }
    return stepCount >= NORMAL_MIN_STEPS;
};
