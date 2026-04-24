/**
 * @purpose Daily puzzle completion tracking and stats management.
 *
 * Stores win state, move counts, and completion dates for daily puzzles.
 * Each daily puzzle (identified by dateKey + difficulty) is tracked independently.
 *
 * localStorage schema:
 * - Key: `numbers-game:daily-stats:{dateKey}:{difficulty}`
 * - Value: JSON object with completion metadata
 */

import type { GameDifficulty, StepData } from '../types.js';

/**
 * Metadata stored for a completed daily puzzle.
 *
 * @property completed - Whether the puzzle was solved.
 * @property moveCount - Number of steps used to complete the puzzle (null if not completed).
 * @property shortestStepCount - Shortest known solution length for the puzzle.
 * @property stars - Player rating based on moveCount versus shortestStepCount.
 * @property completedAt - ISO timestamp of when the puzzle was completed (null if not completed).
 * @property steps - The steps used to solve the puzzle (null if not completed).
 */
export interface DailyPuzzleStats {
    completed: boolean;
    moveCount: number | null;
    shortestStepCount: number | null;
    stars: number | null;
    completedAt: string | null;
    steps: StepData[] | null;
}

/**
 * Generates the localStorage key for a daily puzzle's stats.
 */
const getStatsKey = (dateKey: string, difficulty: GameDifficulty): string => {
    return `numbers-game:daily-stats:${dateKey}:${difficulty}`;
};

/**
 * Retrieves the completion stats for a daily puzzle.
 *
 * @param dateKey - UTC date string in YYYY-MM-DD format
 * @param difficulty - The difficulty level ('easy' or 'normal')
 * @returns Stats object, or null if never attempted
 */
export const getDailyPuzzleStats = (
    dateKey: string,
    difficulty: GameDifficulty
): DailyPuzzleStats | null => {
    const key = getStatsKey(dateKey, difficulty);
    let stored: string | null = null;
    try {
        stored = localStorage.getItem(key);
    } catch {
        console.warn(`[numbers-game] Failed to read daily stats for ${key}`);
        return null;
    }
    if (!stored) return null;

    try {
        const parsed = JSON.parse(stored) as Partial<DailyPuzzleStats>;
        return {
            completed: parsed.completed ?? false,
            moveCount: parsed.moveCount ?? null,
            shortestStepCount: parsed.shortestStepCount ?? null,
            stars: parsed.stars ?? null,
            completedAt: parsed.completedAt ?? null,
            steps: parsed.steps ?? null,
        };
    } catch {
        console.warn(`[numbers-game] Failed to parse daily stats for ${key}`);
        return null;
    }
};

/**
 * Records a win for a daily puzzle.
 *
 * @param dateKey - UTC date string in YYYY-MM-DD format
 * @param difficulty - The difficulty level ('easy' or 'normal')
 * @param moveCount - Number of steps used to reach the target
 * @param steps - The steps used to solve the puzzle
 * @param shortestStepCount - The shortest-path step length for this puzzle
 * @param stars - The player star rating for this completion
 */
export const recordDailyPuzzleWin = (
    dateKey: string,
    difficulty: GameDifficulty,
    moveCount: number,
    steps: StepData[],
    shortestStepCount: number | null = null,
    stars: number | null = null
): void => {
    const key = getStatsKey(dateKey, difficulty);
    const stats: DailyPuzzleStats = {
        completed: true,
        moveCount,
        shortestStepCount,
        stars,
        completedAt: new Date().toISOString(),
        steps,
    };
    try {
        localStorage.setItem(key, JSON.stringify(stats));
    } catch {
        console.warn(`[numbers-game] Failed to persist daily stats for ${key}`);
    }
};

/**
 * Checks if a daily puzzle has been completed.
 *
 * @param dateKey - UTC date string in YYYY-MM-DD format
 * @param difficulty - The difficulty level ('easy' or 'normal')
 * @returns True if the puzzle was completed; false otherwise
 */
export const isDailyPuzzleCompleted = (dateKey: string, difficulty: GameDifficulty): boolean => {
    const stats = getDailyPuzzleStats(dateKey, difficulty);
    return stats?.completed ?? false;
};

/** Removes one daily puzzle stats record. */
export const clearDailyPuzzleStats = (dateKey: string, difficulty: GameDifficulty): void => {
    const key = getStatsKey(dateKey, difficulty);
    try {
        localStorage.removeItem(key);
    } catch {
        console.warn(`[numbers-game] Failed to clear daily stats for ${key}`);
    }
};

/**
 * Clears all stored daily stats (mainly for testing).
 * Use with caution!
 */
export const clearAllDailyStats = (): void => {
    const keys = [];
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('numbers-game:daily-stats:')) {
                keys.push(key);
            }
        }
    } catch {
        console.warn('[numbers-game] Failed to enumerate daily stats keys');
        return;
    }
    keys.forEach((key) => {
        try {
            localStorage.removeItem(key);
        } catch {
            console.warn(`[numbers-game] Failed to remove daily stats key ${key}`);
        }
    });
};
