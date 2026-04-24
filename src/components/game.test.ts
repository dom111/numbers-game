import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateNumbers, isInDifficultyBand, NumbersGameElement } from './game.js';
import { findSolution } from '../lib/solver.js';
import {
    clearAllDailyStats,
    isDailyPuzzleCompleted,
    getDailyPuzzleStats,
} from '../lib/daily-stats.js';

if (!customElements.get('numbers-game')) {
    customElements.define('numbers-game', NumbersGameElement);
}

describe('NumbersGameElement', () => {
    let el: NumbersGameElement;

    const setHash = (hash: string): void => {
        window.history.replaceState(
            null,
            '',
            `${window.location.pathname}${window.location.search}${hash}`
        );
    };

    const getActiveStep = (): HTMLElement =>
        el.querySelector('steps-list step-equation[data-role="active"]') as HTMLElement;

    const completeByOrder = (order: Array<'left' | 'right' | 'operator'>): void => {
        for (const action of order) {
            if (action === 'left') {
                (el.querySelector('numbers-pool #n2 button') as HTMLButtonElement).click();
                continue;
            }

            if (action === 'right') {
                (el.querySelector('numbers-pool #n5 button') as HTMLButtonElement).click();
                continue;
            }

            (
                el.querySelector('operator-buttons button[data-operator="×"]') as HTMLButtonElement
            ).click();
        }
    };

    const getSolvedStepsForRenderedRound = (): Array<{
        id: string;
        left: number;
        operator: '+' | '-' | '×' | '÷';
        right: number;
        value: number;
    }> => {
        const numbers = Array.from(el.querySelectorAll('numbers-pool number-token'))
            .map((token) => Number(token.textContent?.trim() ?? 'NaN'))
            .filter((value) => Number.isInteger(value) && value >= 1);
        const target = Number(el.querySelector('target-number')?.getAttribute('value'));
        const solution = findSolution(numbers, target);
        expect(solution.found).toBe(true);
        return solution.steps;
    };

    beforeEach(() => {
        setHash('');
        el = document.createElement('numbers-game') as NumbersGameElement;
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
        setHash('');
        clearAllDailyStats();
    });

    it('initializes target and six tokens from attributes', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        const target = el.querySelector('target-number');
        expect(target?.getAttribute('value')).toBe('175');

        const numberTokens = el.querySelectorAll('numbers-pool number-token');
        expect(numberTokens).toHaveLength(6);
    });

    it('emits game-won and locks interaction when target is reached', () => {
        el.setAttribute('target', '250');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        const wonHandler = vi.fn();
        el.addEventListener('game-won', wonHandler);

        const stepsList = el.querySelector('steps-list') as HTMLElement;
        stepsList.dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [{ id: 'step-1', left: 5, operator: '×', right: 50, value: 250 }],
                },
            })
        );

        expect(wonHandler).toHaveBeenCalledOnce();
        expect(wonHandler.mock.calls[0][0].detail.target).toBe(250);
        expect(wonHandler.mock.calls[0][0].detail.steps).toHaveLength(1);
        expect(wonHandler.mock.calls[0][0].detail.steps[0].value).toBe(250);

        const allTokenButtons = Array.from(
            el.querySelectorAll('numbers-pool button')
        ) as HTMLButtonElement[];
        expect(allTokenButtons.every((button) => button.disabled)).toBe(true);

        const removeStepButton = el.querySelector(
            'steps-list button[data-remove-step-id="step-1"]'
        ) as HTMLButtonElement;
        expect(removeStepButton.disabled).toBe(true);
        expect(el.querySelector('steps-list step-equation[data-role="active"]')).toBeNull();

        const topStatus = document.body.querySelector('.game-top-status');
        expect(topStatus?.textContent).toBe('You won! Start a new game to play again.');
        expect(el.querySelector('.game-status')).toBeNull();
        expect(el.querySelector('.game-board')?.classList.contains('is-won')).toBe(true);
        expect(el.querySelector('target-number')?.hasAttribute('celebrating')).toBe(true);
    });

    it('removes celebratory board state after reset', () => {
        el.setAttribute('target', '250');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [{ id: 'step-1', left: 5, operator: '×', right: 50, value: 250 }],
                },
            })
        );

        expect(el.querySelector('.game-board')?.classList.contains('is-won')).toBe(true);

        (el.querySelector('button[data-action="reset"]') as HTMLButtonElement).click();

        expect(el.querySelector('.game-board')?.classList.contains('is-won')).toBe(false);
        expect(el.querySelector('target-number')?.hasAttribute('celebrating')).toBe(false);
        expect(document.body.querySelector('.game-top-status')).toBeNull();
    });

    it('does not add extra live region nodes when showing win celebration', () => {
        el.setAttribute('target', '250');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [{ id: 'step-1', left: 5, operator: '×', right: 50, value: 250 }],
                },
            })
        );

        const winLiveRegions = el.querySelectorAll('[aria-live]');
        expect(winLiveRegions).toHaveLength(0);
    });

    it('smooth-scrolls to the top win banner when it is out of view', () => {
        el.setAttribute('target', '250');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
        const scrollSpy = vi.fn();
        Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
            value: scrollSpy,
            configurable: true,
            writable: true,
        });
        const rectSpy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
            x: 0,
            y: -20,
            width: 0,
            height: 10,
            top: -20,
            right: 0,
            bottom: -10,
            left: 0,
            toJSON: () => ({}),
        } as DOMRect);

        try {
            (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
                new CustomEvent('steps-changed', {
                    bubbles: true,
                    detail: {
                        steps: [{ id: 'step-1', left: 5, operator: '×', right: 50, value: 250 }],
                    },
                })
            );

            expect(scrollSpy).toHaveBeenCalledOnce();
        } finally {
            rectSpy.mockRestore();
            Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
                value: originalScrollIntoView,
                configurable: true,
                writable: true,
            });
        }
    });

    it('records daily puzzle win stats when a daily game is won', async () => {
        try {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
            setHash('#difficulty=easy&mode=daily');
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            // The element initializes asynchronously; wait for it
            expect(el.querySelector('target-number')).not.toBeNull();
            const solvedSteps = getSolvedStepsForRenderedRound();

            // Simulate a win by applying a valid solved path.
            const stepsList = el.querySelector('steps-list') as HTMLElement;
            stepsList.dispatchEvent(
                new CustomEvent('steps-changed', {
                    bubbles: true,
                    detail: {
                        steps: solvedSteps,
                    },
                })
            );

            // Verify stats were recorded with steps
            const dateKey = '2026-04-24';
            const stats = getDailyPuzzleStats(dateKey, 'easy');
            expect(stats).not.toBeNull();
            expect(stats?.completed).toBe(true);
            expect(stats?.moveCount).toBe(solvedSteps.length);
            expect(stats?.completedAt).toBeTruthy();
            expect(stats?.steps).toEqual(solvedSteps);
        } finally {
            vi.useRealTimers();
        }
    });

    it('tracks easy and normal daily puzzles independently', async () => {
        const dateKey = '2026-04-24';

        try {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));

            // Complete easy daily puzzle
            setHash(`#difficulty=easy&mode=daily`);
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            const easySolvedSteps = getSolvedStepsForRenderedRound();
            const stepsList = el.querySelector('steps-list') as HTMLElement;
            stepsList.dispatchEvent(
                new CustomEvent('steps-changed', {
                    bubbles: true,
                    detail: {
                        steps: easySolvedSteps,
                    },
                })
            );

            expect(isDailyPuzzleCompleted(dateKey, 'easy')).toBe(true);
            expect(isDailyPuzzleCompleted(dateKey, 'normal')).toBe(false);

            // Complete normal daily puzzle
            el.remove();
            setHash(`#difficulty=normal&mode=daily`);
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            const normalSolvedSteps = getSolvedStepsForRenderedRound();
            const stepsListNormal = el.querySelector('steps-list') as HTMLElement;
            stepsListNormal.dispatchEvent(
                new CustomEvent('steps-changed', {
                    bubbles: true,
                    detail: {
                        steps: normalSolvedSteps,
                    },
                })
            );

            // Both should now be completed but with different move counts and steps
            const easyStats = getDailyPuzzleStats(dateKey, 'easy');
            const normalStats = getDailyPuzzleStats(dateKey, 'normal');
            expect(easyStats?.moveCount).toBe(easySolvedSteps.length);
            expect(easyStats?.steps).toEqual(easySolvedSteps);
            expect(normalStats?.moveCount).toBe(normalSolvedSteps.length);
            expect(normalStats?.steps).toEqual(normalSolvedSteps);
        } finally {
            vi.useRealTimers();
        }
    });

    it('does not record stats for random game wins (only daily)', () => {
        el.setAttribute('target', '250');
        el.setAttribute('numbers', '1,5,7,9,50,75');
        const dateKey = new Date().toISOString().slice(0, 10);

        const stepsList = el.querySelector('steps-list') as HTMLElement;
        stepsList.dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [
                        { id: 'step-1', left: 5, operator: '×' as const, right: 50, value: 250 },
                    ],
                },
            })
        );

        // Stats should not be recorded for random mode
        expect(isDailyPuzzleCompleted(dateKey, 'easy')).toBe(false);
        expect(isDailyPuzzleCompleted(dateKey, 'normal')).toBe(false);
    });

    it('restores completed daily puzzle with steps and celebration when reloading', async () => {
        try {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
            const dateKey = '2026-04-24';

            // First load: Complete a daily puzzle
            setHash('#difficulty=easy&mode=daily');
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            const completedSteps = getSolvedStepsForRenderedRound();
            const stepsList = el.querySelector('steps-list') as HTMLElement;
            stepsList.dispatchEvent(
                new CustomEvent('steps-changed', {
                    bubbles: true,
                    detail: {
                        steps: completedSteps,
                    },
                })
            );

            expect(getDailyPuzzleStats(dateKey, 'easy')?.completed).toBe(true);

            // Second load: Reload the page with the same daily puzzle
            el.remove();
            setHash('#difficulty=easy&mode=daily');
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            // Game should be locked with celebration visible
            const target = el.querySelector('target-number');
            expect(target?.hasAttribute('celebrating')).toBe(true);

            // Top win banner should be visible
            const topStatus = document.body.querySelector('.game-top-status');
            expect(topStatus?.textContent).toBe('You won! Start a new game to play again.');

            // Board should have is-won class
            const gameBoard = el.querySelector('.game-board');
            expect(gameBoard?.classList.contains('is-won')).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('ignores and clears invalid persisted daily completion steps', async () => {
        try {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
            const dateKey = '2026-04-24';
            const key = `numbers-game:daily-stats:${dateKey}:easy`;

            // Impossible restore payload: step value does not match expression result.
            localStorage.setItem(
                key,
                JSON.stringify({
                    completed: true,
                    moveCount: 1,
                    completedAt: '2026-04-24T12:00:00.000Z',
                    steps: [{ id: 'step-1', left: 1, operator: '+' as const, right: 2, value: 99 }],
                })
            );

            setHash('#difficulty=easy&mode=daily');
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            const target = el.querySelector('target-number');
            expect(target?.hasAttribute('celebrating')).toBe(false);
            expect(document.body.querySelector('.game-top-status')).toBeNull();
            expect(localStorage.getItem(key)).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('restores correct daily puzzle state when changing difficulty selector', async () => {
        try {
            vi.useFakeTimers();
            vi.setSystemTime(new Date('2026-04-24T12:00:00.000Z'));
            const dateKey = '2026-04-24';

            // Load Easy mode and complete it
            setHash('#difficulty=easy&mode=daily');
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            const easySolvedSteps = getSolvedStepsForRenderedRound();
            const stepsList = el.querySelector('steps-list') as HTMLElement;
            stepsList.dispatchEvent(
                new CustomEvent('steps-changed', {
                    bubbles: true,
                    detail: { steps: easySolvedSteps },
                })
            );

            expect(getDailyPuzzleStats(dateKey, 'easy')?.completed).toBe(true);

            // Verify easy is celebrated
            let target = el.querySelector('target-number');
            const initialCelebrating = target?.hasAttribute('celebrating');
            expect(initialCelebrating).toBe(true);

            // Simulate clearing by resetting the game
            const resetButton = el.querySelector(
                'button[data-action="reset"]'
            ) as HTMLButtonElement;
            resetButton.click();
            await vi.runAllTimersAsync();

            // After reset, should not be celebrating
            target = el.querySelector('target-number');
            expect(target?.hasAttribute('celebrating')).toBe(false);

            // Reload page with same daily puzzle (simulate page refresh)
            el.remove();
            setHash('#difficulty=easy&mode=daily');
            el = document.createElement('numbers-game') as NumbersGameElement;
            document.body.appendChild(el);
            await vi.runAllTimersAsync();

            // Should restore and show celebration again
            target = el.querySelector('target-number');
            expect(target?.hasAttribute('celebrating')).toBe(true);

            const topStatus = document.body.querySelector('.game-top-status');
            expect(topStatus?.textContent).toBe('You won! Start a new game to play again.');
        } finally {
            vi.useRealTimers();
        }
    });

    it('emits game-reset and restores round state with same target/numbers', () => {
        el.setAttribute('target', '999');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('numbers-pool #n2 button') as HTMLButtonElement).click();
        (
            el.querySelector('operator-buttons button[data-operator="×"]') as HTMLButtonElement
        ).click();
        (el.querySelector('numbers-pool #n5 button') as HTMLButtonElement).click();

        const resetHandler = vi.fn();
        el.addEventListener('game-reset', resetHandler);

        (el.querySelector('button[data-action="reset"]') as HTMLButtonElement).click();

        expect(resetHandler).toHaveBeenCalledOnce();
        expect(el.querySelector('target-number')?.getAttribute('value')).toBe('999');

        const activeStep = getActiveStep();
        expect(activeStep.getAttribute('id')).toBe('step-1');

        const tokenButtonAfterReset = el.querySelector(
            'numbers-pool #n2 button'
        ) as HTMLButtonElement;
        expect(tokenButtonAfterReset.disabled).toBe(false);
    });

    it('keeps selected operator after choosing right operand in active step', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('numbers-pool #n2 button') as HTMLButtonElement).click();

        (
            el.querySelector('operator-buttons button[data-operator="-"]') as HTMLButtonElement
        ).click();

        (el.querySelector('numbers-pool #n6 button') as HTMLButtonElement).click();

        const activeStepAfterRight = getActiveStep();
        expect(activeStepAfterRight.getAttribute('id')).toBe('step-1');
        expect(activeStepAfterRight.getAttribute('operator')).toBe('-');
        expect(activeStepAfterRight.getAttribute('right')).toBe('75');
    });

    it('syncs selected number token highlights with active-step operand assignments', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('numbers-pool #n2 button') as HTMLButtonElement).click();
        (el.querySelector('numbers-pool #n5 button') as HTMLButtonElement).click();

        let selected = el.querySelectorAll('numbers-pool number-token[selected]');
        expect(selected).toHaveLength(2);

        // Clicking left again clears left and right from the active step.
        (el.querySelector('numbers-pool #n2 button') as HTMLButtonElement).click();

        selected = el.querySelectorAll('numbers-pool number-token[selected]');
        expect(selected).toHaveLength(0);
    });

    it('rebuilds token pool when steps are removed', () => {
        el.setAttribute('target', '999');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [
                        { id: 'step-1', left: 75, operator: '-', right: 50, value: 25 },
                        { id: 'step-2', left: 9, operator: '×', right: 25, value: 225 },
                    ],
                },
            })
        );

        let tokens = el.querySelectorAll('numbers-pool number-token');
        expect(tokens).toHaveLength(8);

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: { steps: [] },
            })
        );

        tokens = el.querySelectorAll('numbers-pool number-token');
        expect(tokens).toHaveLength(6);
    });

    it('completes step and appends result token for order left, right, operand', () => {
        el.setAttribute('target', '999');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        completeByOrder(['left', 'right', 'operator']);

        const completedSteps = el.querySelectorAll('steps-list step-equation[locked]');
        expect(completedSteps).toHaveLength(1);

        const resultToken = el.querySelector('numbers-pool #n7 button') as HTMLButtonElement;
        expect(resultToken.textContent).toBe('250');
        expect(resultToken.disabled).toBe(false);
    });

    it('completes step and appends result token for order operand, left, right', () => {
        el.setAttribute('target', '999');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        completeByOrder(['operator', 'left']);

        const activeBeforeRight = getActiveStep();
        expect(activeBeforeRight.getAttribute('operator')).toBe('×');

        completeByOrder(['right']);

        const completedSteps = el.querySelectorAll('steps-list step-equation[locked]');
        expect(completedSteps).toHaveLength(1);

        const resultToken = el.querySelector('numbers-pool #n7 button') as HTMLButtonElement;
        expect(resultToken.textContent).toBe('250');
        expect(resultToken.disabled).toBe(false);
    });

    it('completes step and appends result token for order left, operand, right', () => {
        el.setAttribute('target', '999');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        completeByOrder(['left', 'operator']);

        const activeBeforeRight = getActiveStep();
        expect(activeBeforeRight.getAttribute('operator')).toBe('×');

        completeByOrder(['right']);

        const completedSteps = el.querySelectorAll('steps-list step-equation[locked]');
        expect(completedSteps).toHaveLength(1);

        const resultToken = el.querySelector('numbers-pool #n7 button') as HTMLButtonElement;
        expect(resultToken.textContent).toBe('250');
        expect(resultToken.disabled).toBe(false);
    });

    it('shows Error and does not append a result token for an invalid complete expression', () => {
        el.setAttribute('target', '999');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('numbers-pool #n2 button') as HTMLButtonElement).click();
        (
            el.querySelector('operator-buttons button[data-operator="÷"]') as HTMLButtonElement
        ).click();
        (el.querySelector('numbers-pool #n3 button') as HTMLButtonElement).click(); // 5 ÷ 7 invalid

        const active = getActiveStep();
        expect(active.getAttribute('id')).toBe('step-1');
        expect(active.querySelector('.step-value')?.textContent).toBe('= Error');
        expect(active.querySelector('.step-value')?.classList.contains('error')).toBe(true);

        const completedSteps = el.querySelectorAll('steps-list step-equation[locked]');
        expect(completedSteps).toHaveLength(0);

        const tokens = el.querySelectorAll('numbers-pool number-token');
        expect(tokens).toHaveLength(6);
    });

    it('shows a hint that uses only available numbers after 75 - 50 = 25', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [{ id: 'step-1', left: 75, operator: '-', right: 50, value: 25 }],
                },
            })
        );

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();

        const hintText = el.querySelector('.hint-display')?.textContent ?? '';
        expect(hintText).toMatch(/^Try using \d+ and \d+$/);
        expect(hintText).not.toContain('50');
        expect(hintText).not.toContain('75');
        expect(hintText).not.toContain('25 and 25');
    });

    it('prefers a shorter child-friendlier hint path for 175 from 1,5,7,9,50,75', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();
        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();
        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();

        const hintText = el.querySelector('.hint-display')?.textContent ?? '';
        expect(hintText).not.toBe('75 + 50 = 125');
        expect(['75 - 50 = 25', '5 × 50 = 250']).toContain(hintText);
    });

    it('suggests removing the latest step when no hint is available', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();
        expect(el.querySelector('.hint-display')?.textContent).toContain('Try using');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [
                        { id: 'step-1', left: 75, operator: '-', right: 50, value: 25 },
                        { id: 'step-2', left: 25, operator: '-', right: 9, value: 16 },
                        { id: 'step-3', left: 16, operator: '+', right: 7, value: 23 },
                        { id: 'step-4', left: 23, operator: '+', right: 5, value: 28 },
                        { id: 'step-5', left: 28, operator: '-', right: 1, value: 27 },
                    ],
                },
            })
        );

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();
        expect(el.querySelector('.hint-display')?.textContent).toBe(
            'No hint available. Try removing the latest step.'
        );
        expect(
            (el.querySelector('steps-list') as HTMLElement).getAttribute('rollback-step-id')
        ).toBe('step-5');
    });

    it('suggests removing latest step when solver has no hint and >= 2 tokens remain', () => {
        el.setAttribute('target', '17');
        el.setAttribute('numbers', '1,1,1,1,1,1');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [{ id: 'step-1', left: 1, operator: '+', right: 1, value: 2 }],
                },
            })
        );

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();

        expect(el.querySelector('.hint-display')?.textContent).toBe(
            'No hint available. Try removing the latest step.'
        );
        expect(
            (el.querySelector('steps-list') as HTMLElement).getAttribute('rollback-step-id')
        ).toBe('step-1');
    });

    it('clears rollback highlight when hints become available again', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [
                        { id: 'step-1', left: 75, operator: '-', right: 50, value: 25 },
                        { id: 'step-2', left: 25, operator: '-', right: 9, value: 16 },
                        { id: 'step-3', left: 16, operator: '+', right: 7, value: 23 },
                        { id: 'step-4', left: 23, operator: '+', right: 5, value: 28 },
                        { id: 'step-5', left: 28, operator: '-', right: 1, value: 27 },
                    ],
                },
            })
        );

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();
        expect(
            (el.querySelector('steps-list') as HTMLElement).getAttribute('rollback-step-id')
        ).toBe('step-5');

        (el.querySelector('steps-list') as HTMLElement).dispatchEvent(
            new CustomEvent('steps-changed', {
                bubbles: true,
                detail: {
                    steps: [{ id: 'step-1', left: 75, operator: '-', right: 50, value: 25 }],
                },
            })
        );

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();
        expect(el.querySelector('.hint-display')?.textContent).toContain('Try using');
        expect(
            (el.querySelector('steps-list') as HTMLElement).hasAttribute('rollback-step-id')
        ).toBe(false);
    });

    it('cancels pending new-game generation when element disconnects', () => {
        vi.useFakeTimers();

        try {
            const handler = vi.fn();
            el.addEventListener('game-new', handler);

            (el.querySelector('button[data-action="new"]') as HTMLButtonElement).click();
            el.remove();

            vi.runAllTimers();
            expect(handler).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });

    it('disables gameplay controls while generating a new game', () => {
        vi.useFakeTimers();

        try {
            el.setAttribute('target', '175');
            el.setAttribute('numbers', '1,5,7,9,50,75');

            const newButton = el.querySelector('button[data-action="new"]') as HTMLButtonElement;
            newButton.click();

            expect(el.querySelector('.loading-message')?.textContent).toBe(
                'Generating new game...'
            );
            expect(el.querySelector('.loading-message')?.getAttribute('role')).toBe('status');
            expect(el.querySelector('.loading-message')?.getAttribute('aria-live')).toBe('polite');

            expect(
                (el.querySelector('button[data-action="reset"]') as HTMLButtonElement).disabled
            ).toBe(true);
            expect(
                (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).disabled
            ).toBe(true);
            expect(
                (el.querySelector('button[data-action="new"]') as HTMLButtonElement).disabled
            ).toBe(true);
            expect(
                (el.querySelector('.difficulty-controls select') as HTMLSelectElement).disabled
            ).toBe(true);

            expect(el.querySelector('steps-list step-equation[data-role="active"]')).toBeNull();

            (el.querySelector('numbers-pool #n2 button') as HTMLButtonElement).click();
            (
                el.querySelector('operator-buttons button[data-operator="+"]') as HTMLButtonElement
            ).click();

            expect(el.querySelector('steps-list step-equation[data-role="active"]')).toBeNull();

            vi.runAllTimers();

            expect(el.querySelector('.loading-message')).toBeNull();
            expect(
                (el.querySelector('button[data-action="reset"]') as HTMLButtonElement).disabled
            ).toBe(false);
            expect(
                (el.querySelector('button[data-action="new"]') as HTMLButtonElement).disabled
            ).toBe(false);
        } finally {
            vi.useRealTimers();
        }
    });

    it('preselects easy difficulty from hash', () => {
        el.remove();
        setHash('#difficulty=easy');

        el = document.createElement('numbers-game') as NumbersGameElement;
        document.body.appendChild(el);

        const select = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;
        expect(select.value).toBe('easy');
    });

    it('preselects daily mode from hash and shows a locale-independent date badge', () => {
        el.remove();
        setHash('#difficulty=easy&mode=daily');

        el = document.createElement('numbers-game') as NumbersGameElement;
        document.body.appendChild(el);

        const dailyBadge = el.querySelector('.daily-badge');
        expect(dailyBadge?.textContent).toMatch(/^Daily — \d{4}-\d{2}-\d{2}$/);
        expect(
            (el.querySelector('button[data-action="daily"]') as HTMLButtonElement).disabled
        ).toBe(true);

        const select = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;
        expect(select.value).toBe('easy');
    });

    it('falls back to normal difficulty for invalid hash values', () => {
        el.remove();
        setHash('#difficulty=hard');

        el = document.createElement('numbers-game') as NumbersGameElement;
        document.body.appendChild(el);

        const select = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;
        expect(select.value).toBe('normal');
    });

    it('updates hash when difficulty selector changes', () => {
        const select = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;

        select.value = 'easy';
        select.dispatchEvent(new Event('change', { bubbles: true }));

        expect(window.location.hash).toBe('#difficulty=easy');
    });

    it('starts a new round when difficulty selector changes', () => {
        vi.useFakeTimers();

        try {
            const gameNewHandler = vi.fn();
            el.addEventListener('game-new', gameNewHandler);

            const select = el.querySelector(
                '.difficulty-controls select[data-action="difficulty"]'
            ) as HTMLSelectElement;

            select.value = 'easy';
            select.dispatchEvent(new Event('change', { bubbles: true }));

            expect(el.querySelector('.loading-message')?.textContent).toBe(
                'Generating new game...'
            );
            expect(
                (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).disabled
            ).toBe(true);

            vi.runAllTimers();

            expect(gameNewHandler).toHaveBeenCalledOnce();
            expect(window.location.hash).toBe('#difficulty=easy');
            expect(el.querySelector('.loading-message')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('renders difficulty controls inside the main game controls row', () => {
        const controls = el.querySelector('.game-controls') as HTMLElement;
        const difficultyControls = el.querySelector('.difficulty-controls') as HTMLElement;
        const select = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;

        expect(controls.contains(select)).toBe(true);
        expect(controls.lastElementChild).toBe(difficultyControls);
        expect(controls.getAttribute('role')).toBe('group');
        expect(controls.getAttribute('aria-label')).toBe('Gameplay controls');
    });

    it('moves focus between numbers, operators, and controls with arrow up/down', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        const firstNumber = el.querySelector('numbers-pool #n1 button') as HTMLButtonElement;
        const plusOperator = el.querySelector(
            'operator-buttons button[data-operator="+"]'
        ) as HTMLButtonElement;
        const resetButton = el.querySelector('button[data-action="reset"]') as HTMLButtonElement;

        firstNumber.focus();
        firstNumber.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        );
        expect(document.activeElement).toBe(plusOperator);

        plusOperator.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        );
        expect(document.activeElement).toBe(resetButton);

        resetButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
        expect(document.activeElement).toBe(plusOperator);
    });

    it('moves focus across bottom controls with arrow left/right and Home/End', () => {
        const resetButton = el.querySelector('button[data-action="reset"]') as HTMLButtonElement;
        const hintButton = el.querySelector('button[data-action="hint"]') as HTMLButtonElement;
        const newButton = el.querySelector('button[data-action="new"]') as HTMLButtonElement;
        const dailyButton = el.querySelector('button[data-action="daily"]') as HTMLButtonElement;
        const difficultySelect = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;

        resetButton.focus();
        resetButton.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );
        expect(document.activeElement).toBe(hintButton);

        hintButton.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );
        expect(document.activeElement).toBe(newButton);

        newButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        expect(document.activeElement).toBe(dailyButton);

        dailyButton.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true })
        );
        expect(document.activeElement).toBe(difficultySelect);

        newButton.focus();
        newButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
        expect(document.activeElement).toBe(resetButton);

        resetButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
        expect(document.activeElement).toBe(difficultySelect);
    });

    it('does not intercept arrow key behavior on difficulty select', () => {
        const difficultySelect = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;
        const resetButton = el.querySelector('button[data-action="reset"]') as HTMLButtonElement;

        resetButton.focus();
        difficultySelect.focus();
        difficultySelect.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
        );

        expect(document.activeElement).toBe(difficultySelect);
    });

    it('renders hint messages in a polite live region', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        (el.querySelector('button[data-action="hint"]') as HTMLButtonElement).click();

        const hintDisplay = el.querySelector('.hint-display') as HTMLElement;
        expect(hintDisplay.getAttribute('role')).toBe('status');
        expect(hintDisplay.getAttribute('aria-live')).toBe('polite');
    });

    it('changing difficulty attribute does not re-roll numbers or target', () => {
        el.setAttribute('target', '175');
        el.setAttribute('numbers', '1,5,7,9,50,75');

        const targetBefore = el.querySelector('target-number')?.getAttribute('value');
        const tokensBefore = Array.from(el.querySelectorAll('numbers-pool number-token')).map(
            (t) => t.textContent
        );

        el.setAttribute('difficulty', 'easy');

        const targetAfter = el.querySelector('target-number')?.getAttribute('value');
        const tokensAfter = Array.from(el.querySelectorAll('numbers-pool number-token')).map(
            (t) => t.textContent
        );

        expect(targetAfter).toBe(targetBefore);
        expect(tokensAfter).toEqual(tokensBefore);

        const select = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;
        expect(select.value).toBe('easy');
    });

    it('invalid difficulty attribute does not prevent hash from taking effect on hashchange', () => {
        el.setAttribute('difficulty', 'extreme'); // invalid — should not block hash
        setHash('#difficulty=easy');
        window.dispatchEvent(new Event('hashchange'));

        const select = el.querySelector(
            '.difficulty-controls select[data-action="difficulty"]'
        ) as HTMLSelectElement;
        expect(select.value).toBe('easy');
    });

    it('starts generation when hash mode changes to daily', () => {
        vi.useFakeTimers();

        try {
            setHash('#mode=daily');
            window.dispatchEvent(new Event('hashchange'));

            expect(el.querySelector('.loading-message')?.textContent).toBe(
                'Generating new game...'
            );

            vi.runAllTimers();

            const dailyButton = el.querySelector(
                'button[data-action="daily"]'
            ) as HTMLButtonElement;
            expect(dailyButton.getAttribute('aria-pressed')).toBe('true');
            expect(dailyButton.disabled).toBe(true);
        } finally {
            vi.useRealTimers();
        }
    });

    it('applies hash mode changes even when difficulty attribute is authoritative', () => {
        vi.useFakeTimers();

        try {
            el.setAttribute('difficulty', 'easy');

            setHash('#difficulty=normal&mode=daily');
            window.dispatchEvent(new Event('hashchange'));
            vi.runAllTimers();

            const select = el.querySelector(
                '.difficulty-controls select[data-action="difficulty"]'
            ) as HTMLSelectElement;
            expect(select.value).toBe('easy');

            const dailyButton = el.querySelector(
                'button[data-action="daily"]'
            ) as HTMLButtonElement;
            expect(dailyButton.getAttribute('aria-pressed')).toBe('true');
        } finally {
            vi.useRealTimers();
        }
    });
});

describe('generateNumbers', () => {
    it('never exceeds pool duplicate limits', () => {
        for (let i = 0; i < 200; i += 1) {
            const draw = generateNumbers();
            expect(draw).toHaveLength(6);

            const counts = new Map<number, number>();
            for (const value of draw) {
                counts.set(value, (counts.get(value) ?? 0) + 1);
            }

            for (let n = 1; n <= 10; n += 1) {
                expect(counts.get(n) ?? 0).toBeLessThanOrEqual(2);
            }

            expect(counts.get(25) ?? 0).toBeLessThanOrEqual(1);
            expect(counts.get(50) ?? 0).toBeLessThanOrEqual(1);
            expect(counts.get(75) ?? 0).toBeLessThanOrEqual(1);
            expect(counts.get(100) ?? 0).toBeLessThanOrEqual(1);
        }
    });
});

describe('isInDifficultyBand', () => {
    it('accepts easy paths shorter than 4 and rejects longer paths', () => {
        expect(isInDifficultyBand('easy', 1)).toBe(true);
        expect(isInDifficultyBand('easy', 3)).toBe(true);
        expect(isInDifficultyBand('easy', 4)).toBe(false);
    });

    it('accepts normal paths longer than 3 and rejects shorter paths', () => {
        expect(isInDifficultyBand('normal', 4)).toBe(true);
        expect(isInDifficultyBand('normal', 6)).toBe(true);
        expect(isInDifficultyBand('normal', 3)).toBe(false);
    });
});
