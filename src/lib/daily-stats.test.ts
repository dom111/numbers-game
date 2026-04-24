/**
 * Test suite for daily-stats.ts — daily puzzle completion tracking
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    getDailyPuzzleStats,
    recordDailyPuzzleWin,
    isDailyPuzzleCompleted,
    clearDailyPuzzleStats,
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
            const steps = [{ id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 }];
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, steps);
            const stats = getDailyPuzzleStats('2026-04-24', 'easy');
            expect(stats).not.toBeNull();
            expect(stats?.completed).toBe(true);
            expect(stats?.moveCount).toBe(1);
            expect(stats?.completedAt).toBeTruthy();
            expect(stats?.steps).toEqual(steps);
        });

        it('handles malformed JSON gracefully', () => {
            localStorage.setItem('numbers-game:daily-stats:2026-04-24:easy', 'invalid json {');
            const stats = getDailyPuzzleStats('2026-04-24', 'easy');
            expect(stats).toBeNull();
        });
    });

    describe('recordDailyPuzzleWin', () => {
        it('stores completion stats with a valid moveCount', () => {
            const steps = [
                { id: 'step-1', left: 10, operator: '+' as const, right: 15, value: 25 },
            ];
            recordDailyPuzzleWin('2026-04-24', 'normal', 1, steps);
            const stats = getDailyPuzzleStats('2026-04-24', 'normal');
            expect(stats?.completed).toBe(true);
            expect(stats?.moveCount).toBe(1);
            expect(stats?.steps).toEqual(steps);
        });

        it('stores an ISO timestamp when recording a win', () => {
            const steps = [{ id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 }];
            const before = new Date().toISOString();
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, steps);
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
            const easySteps = [
                { id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 },
            ];
            const normalSteps = [
                { id: 'step-1', left: 50, operator: '+' as const, right: 75, value: 125 },
                { id: 'step-2', left: 125, operator: '+' as const, right: 100, value: 225 },
            ];
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, easySteps);
            recordDailyPuzzleWin('2026-04-24', 'normal', 2, normalSteps);

            const easyStats = getDailyPuzzleStats('2026-04-24', 'easy');
            const normalStats = getDailyPuzzleStats('2026-04-24', 'normal');

            expect(easyStats?.moveCount).toBe(1);
            expect(easyStats?.steps).toEqual(easySteps);
            expect(normalStats?.moveCount).toBe(2);
            expect(normalStats?.steps).toEqual(normalSteps);
        });

        it('overwrites previous stats if a puzzle is completed again', () => {
            const stepsV1 = [{ id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 }];
            const stepsV2 = [
                { id: 'step-1', left: 5, operator: '+' as const, right: 10, value: 15 },
                { id: 'step-2', left: 15, operator: '+' as const, right: 10, value: 25 },
            ];
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, stepsV1);
            const first = getDailyPuzzleStats('2026-04-24', 'easy');

            // Simulate completing it again with different steps
            recordDailyPuzzleWin('2026-04-24', 'easy', 2, stepsV2);
            const second = getDailyPuzzleStats('2026-04-24', 'easy');

            expect(first?.moveCount).toBe(1);
            expect(first?.steps).toEqual(stepsV1);
            expect(second?.moveCount).toBe(2);
            expect(second?.steps).toEqual(stepsV2);
        });
    });

    describe('isDailyPuzzleCompleted', () => {
        it('returns false for never-attempted puzzles', () => {
            const completed = isDailyPuzzleCompleted('2026-04-24', 'easy');
            expect(completed).toBe(false);
        });

        it('returns true after recording a win', () => {
            const steps = [{ id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 }];
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, steps);
            const completed = isDailyPuzzleCompleted('2026-04-24', 'easy');
            expect(completed).toBe(true);
        });

        it('tracks easy and normal independently', () => {
            const easySteps = [
                { id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 },
            ];
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, easySteps);
            const easyCompleted = isDailyPuzzleCompleted('2026-04-24', 'easy');
            const normalCompleted = isDailyPuzzleCompleted('2026-04-24', 'normal');
            expect(easyCompleted).toBe(true);
            expect(normalCompleted).toBe(false);
        });
    });

    describe('clearAllDailyStats', () => {
        it('removes only the specified daily stats entry', () => {
            const easySteps = [
                { id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 },
            ];
            const normalSteps = [
                { id: 'step-1', left: 10, operator: '+' as const, right: 15, value: 25 },
            ];
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, easySteps);
            recordDailyPuzzleWin('2026-04-24', 'normal', 1, normalSteps);

            clearDailyPuzzleStats('2026-04-24', 'easy');

            expect(isDailyPuzzleCompleted('2026-04-24', 'easy')).toBe(false);
            expect(isDailyPuzzleCompleted('2026-04-24', 'normal')).toBe(true);
        });

        it('removes all daily stats from localStorage', () => {
            const easySteps = [
                { id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 3 },
            ];
            const normalSteps = [
                { id: 'step-1', left: 10, operator: '+' as const, right: 15, value: 25 },
            ];
            const otherSteps = [
                { id: 'step-1', left: 5, operator: '+' as const, right: 5, value: 10 },
            ];
            recordDailyPuzzleWin('2026-04-24', 'easy', 1, easySteps);
            recordDailyPuzzleWin('2026-04-24', 'normal', 1, normalSteps);
            recordDailyPuzzleWin('2026-04-25', 'easy', 1, otherSteps);

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
