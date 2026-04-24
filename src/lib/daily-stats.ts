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

import type { GameDifficulty } from '../types.js';

/**
 * Metadata stored for a completed daily puzzle.
 *
 * @property completed - Whether the puzzle was solved.
 * @property moveCount - Number of steps used to complete the puzzle (null if not completed).
 * @property completedAt - ISO timestamp of when the puzzle was completed (null if not completed).
 */
export interface DailyPuzzleStats {
    completed: boolean;
    moveCount: number | null;
    completedAt: string | null;
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
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    try {
        return JSON.parse(stored) as DailyPuzzleStats;
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
 */
export const recordDailyPuzzleWin = (
    dateKey: string,
    difficulty: GameDifficulty,
    moveCount: number
): void => {
    const key = getStatsKey(dateKey, difficulty);
    const stats: DailyPuzzleStats = {
        completed: true,
        moveCount,
        completedAt: new Date().toISOString(),
    };
    localStorage.setItem(key, JSON.stringify(stats));
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

/**
 * Clears all stored daily stats (mainly for testing).
 * Use with caution!
 */
export const clearAllDailyStats = (): void => {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('numbers-game:daily-stats:')) {
            keys.push(key);
        }
    }
    keys.forEach((key) => localStorage.removeItem(key));
};
