/**
 * Test suite for daily-stats.ts — daily puzzle completion tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getDailyPuzzleStats,
    recordDailyPuzzleWin,
    isDailyPuzzleCompleted,
    clearAllDailyStats,
} from './daily-stats.js';

describe('daily-stats', () => {
    beforeEach(() => {
        clearAllDailyStats();
    });

    afterEach(() => {
        clearAllDailyStats();
    });

    describe('getDailyPuzzleStats', () => {
        it('returns null when a puzzle has never been attempted', () => {
            const stats = getDailyPuzzleStats('2026-04-24', 'easy');
            expect(stats).toBeNull();
        });

        it('returns stored stats after a puzzle is completed', () => {
            recordDailyPuzzleWin('2026-04-24', 'easy', 3);
            const stats = getDailyPuzzleStats('2026-04-24', 'easy');
            expect(stats).not.toBeNull();
            expect(stats?.completed).toBe(true);
            expect(stats?.moveCount).toBe(3);
            expect(stats?.completedAt).toBeTruthy();
        });

        it('handles malformed JSON gracefully', () => {
            localStorage.setItem('numbers-game:daily-stats:2026-04-24:easy', 'invalid json {');
            const stats = getDailyPuzzleStats('2026-04-24', 'easy');
            expect(stats).toBeNull();
        });
    });

    describe('recordDailyPuzzleWin', () => {
        it('stores completion stats with a valid moveCount', () => {
            recordDailyPuzzleWin('2026-04-24', 'normal', 5);
            const stats = getDailyPuzzleStats('2026-04-24', 'normal');
            expect(stats?.completed).toBe(true);
            expect(stats?.moveCount).toBe(5);
        });

        it('stores an ISO timestamp when recording a win', () => {
            const before = new Date().toISOString();
            recordDailyPuzzleWin('2026-04-24', 'easy', 2);
            const after = new Date().toISOString();
            const stats = getDailyPuzzleStats('2026-04-24', 'easy');
            expect(stats?.completedAt).toBeTruthy();
            if (stats?.completedAt) {
                // Compare ISO strings lexicographically (valid since they're in YYYY-MM-DDTHH:mm:ss.sssZ format)
                expect(stats.completedAt >= before).toBe(true);
                expect(stats.completedAt <= after).toBe(true);
            }
        });

        it('allows tracking easy and normal separately for the same date', () => {
            recordDailyPuzzleWin('2026-04-24', 'easy', 2);
            recordDailyPuzzleWin('2026-04-24', 'normal', 4);

            const easyStats = getDailyPuzzleStats('2026-04-24', 'easy');
            const normalStats = getDailyPuzzleStats('2026-04-24', 'normal');

            expect(easyStats?.moveCount).toBe(2);
            expect(normalStats?.moveCount).toBe(4);
        });

        it('overwrites previous stats if a puzzle is completed again', () => {
            recordDailyPuzzleWin('2026-04-24', 'easy', 5);
            const first = getDailyPuzzleStats('2026-04-24', 'easy');

            // Simulate completing it again (unlikely but good to be safe)
            recordDailyPuzzleWin('2026-04-24', 'easy', 3);
            const second = getDailyPuzzleStats('2026-04-24', 'easy');

            expect(first?.moveCount).toBe(5);
            expect(second?.moveCount).toBe(3);
        });
    });

    describe('isDailyPuzzleCompleted', () => {
        it('returns false for never-attempted puzzles', () => {
            const completed = isDailyPuzzleCompleted('2026-04-24', 'easy');
            expect(completed).toBe(false);
        });

        it('returns true after recording a win', () => {
            recordDailyPuzzleWin('2026-04-24', 'easy', 3);
            const completed = isDailyPuzzleCompleted('2026-04-24', 'easy');
            expect(completed).toBe(true);
        });

        it('tracks easy and normal independently', () => {
            recordDailyPuzzleWin('2026-04-24', 'easy', 2);
            const easyCompleted = isDailyPuzzleCompleted('2026-04-24', 'easy');
            const normalCompleted = isDailyPuzzleCompleted('2026-04-24', 'normal');
            expect(easyCompleted).toBe(true);
            expect(normalCompleted).toBe(false);
        });
    });

    describe('clearAllDailyStats', () => {
        it('removes all daily stats from localStorage', () => {
            recordDailyPuzzleWin('2026-04-24', 'easy', 2);
            recordDailyPuzzleWin('2026-04-24', 'normal', 4);
            recordDailyPuzzleWin('2026-04-25', 'easy', 3);

            expect(isDailyPuzzleCompleted('2026-04-24', 'easy')).toBe(true);
            expect(isDailyPuzzleCompleted('2026-04-24', 'normal')).toBe(true);
            expect(isDailyPuzzleCompleted('2026-04-25', 'easy')).toBe(true);

            clearAllDailyStats();

            expect(isDailyPuzzleCompleted('2026-04-24', 'easy')).toBe(false);
            expect(isDailyPuzzleCompleted('2026-04-24', 'normal')).toBe(false);
            expect(isDailyPuzzleCompleted('2026-04-25', 'easy')).toBe(false);
        });

        it('does not remove unrelated localStorage items', () => {
            localStorage.setItem('other-app:data', 'keep this');
            clearAllDailyStats();
            expect(localStorage.getItem('other-app:data')).toBe('keep this');
        });
    });
});

