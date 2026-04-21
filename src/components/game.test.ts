import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { generateNumbers, NumbersGameElement } from './game.js';

if (!customElements.get('numbers-game')) {
    customElements.define('numbers-game', NumbersGameElement);
}

describe('NumbersGameElement', () => {
    let el: NumbersGameElement;

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

    beforeEach(() => {
        el = document.createElement('numbers-game') as NumbersGameElement;
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
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

    it('clears stale hint text when fewer than two numbers remain', () => {
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
        expect(el.querySelector('.hint-display')?.textContent).toBe('No hint available.');
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
