import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StepEquationElement } from './step.js';

if (!customElements.get('step-equation')) {
    customElements.define('step-equation', StepEquationElement);
}

describe('StepEquationElement', () => {
    let el: StepEquationElement;

    const applyOrder = (
        target: StepEquationElement,
        order: Array<'left' | 'right' | 'operator'>
    ): void => {
        for (const slot of order) {
            if (slot === 'left') {
                target.setAttribute('left', '5');
                continue;
            }

            if (slot === 'right') {
                target.setAttribute('right', '50');
                continue;
            }

            target.setAttribute('operator', '×');
        }
    };

    beforeEach(() => {
        el = document.createElement('step-equation') as StepEquationElement;
        el.id = 'step-1';
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
    });

    it('renders with placeholder output when incomplete', () => {
        expect(el.querySelector('.step-value')?.textContent).toBe('= ?');
    });

    it('emits step-complete for a valid complete step', () => {
        const handler = vi.fn();
        el.addEventListener('step-complete', handler);

        el.setAttribute('left', '5');
        el.setAttribute('operator', '×');
        el.setAttribute('right', '50');

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({
            id: 'step-1',
            left: 5,
            operator: '×',
            right: 50,
            value: 250,
        });
    });

    it.each([
        ['left, right, operator', ['left', 'right', 'operator']],
        ['operator, left, right', ['operator', 'left', 'right']],
        ['left, operator, right', ['left', 'operator', 'right']],
    ] as const)('completes and renders value for input order %s', (_label, order) => {
        const handler = vi.fn();
        el.addEventListener('step-complete', handler);

        applyOrder(el, [...order]);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({
            id: 'step-1',
            left: 5,
            operator: '×',
            right: 50,
            value: 250,
        });
        expect(el.querySelector('.step-value')?.textContent).toBe('= 250');
    });

    it('does not emit step-complete for invalid subtraction', () => {
        const handler = vi.fn();
        el.addEventListener('step-complete', handler);

        el.setAttribute('left', '3');
        el.setAttribute('operator', '-');
        el.setAttribute('right', '5');

        expect(handler).not.toHaveBeenCalled();
    });

    it('does not emit step-complete for non-integer division', () => {
        const handler = vi.fn();
        el.addEventListener('step-complete', handler);

        el.setAttribute('left', '10');
        el.setAttribute('operator', '÷');
        el.setAttribute('right', '3');

        expect(handler).not.toHaveBeenCalled();
    });

    it('emits step-cleared when a previously valid step becomes invalid', () => {
        const completeHandler = vi.fn();
        const clearedHandler = vi.fn();

        el.addEventListener('step-complete', completeHandler);
        el.addEventListener('step-cleared', clearedHandler);

        el.setAttribute('left', '10');
        el.setAttribute('operator', '-');
        el.setAttribute('right', '2');
        el.setAttribute('right', '20');

        expect(completeHandler).toHaveBeenCalledOnce();
        expect(clearedHandler).toHaveBeenCalledOnce();
        expect(clearedHandler.mock.calls[0][0].detail).toEqual({ id: 'step-1' });
    });

    it('does not render local operator buttons', () => {
        expect(el.querySelector('operator-buttons')).toBeNull();
    });

    it('shows computed value text when valid', () => {
        el.setAttribute('left', '250');
        el.setAttribute('operator', '-');
        el.setAttribute('right', '75');

        expect(el.querySelector('.step-value')?.textContent).toBe('= 175');
    });

    it('emits step-complete when configured before connecting', () => {
        const detached = document.createElement('step-equation') as StepEquationElement;
        detached.id = 'step-preconfigured';
        detached.setAttribute('left', '5');
        detached.setAttribute('operator', '×');
        detached.setAttribute('right', '50');

        const handler = vi.fn();
        detached.addEventListener('step-complete', handler);
        document.body.appendChild(detached);

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({
            id: 'step-preconfigured',
            left: 5,
            operator: '×',
            right: 50,
            value: 250,
        });

        detached.remove();
    });

    it('shows Error for complete but invalid expressions', () => {
        el.setAttribute('left', '10');
        el.setAttribute('operator', '÷');
        el.setAttribute('right', '3');

        expect(el.querySelector('.step-value')?.textContent).toBe('= Error');
    });

    it('emits step-token-remove when clicking a selected operand chip', () => {
        const handler = vi.fn();
        el.addEventListener('step-token-remove', handler);

        el.setAttribute('left', '50');
        el.setAttribute('left-token-id', 'n1');

        const chip = el.querySelector('button.step-chip[data-slot="left"]') as HTMLButtonElement;
        chip.click();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({ slot: 'left', tokenId: 'n1' });
    });
});
