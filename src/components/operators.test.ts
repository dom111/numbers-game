import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperatorButtonsElement } from './operators.js';

if (!customElements.get('operator-buttons')) {
    customElements.define('operator-buttons', OperatorButtonsElement);
}

describe('OperatorButtonsElement', () => {
    let el: OperatorButtonsElement;

    beforeEach(() => {
        el = document.createElement('operator-buttons') as OperatorButtonsElement;
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
    });

    it('renders four operator buttons', () => {
        const labels = Array.from(el.querySelectorAll('button')).map(
            (button) => button.textContent
        );
        expect(labels).toEqual(['+', '-', '×', '÷']);
    });

    it('applies accessible labels for each operator button', () => {
        expect(el.querySelector('button[data-operator="+"]')?.getAttribute('aria-label')).toBe(
            'Add'
        );
        expect(el.querySelector('button[data-operator="-"]')?.getAttribute('aria-label')).toBe(
            'Subtract'
        );
        expect(el.querySelector('button[data-operator="×"]')?.getAttribute('aria-label')).toBe(
            'Multiply'
        );
        expect(el.querySelector('button[data-operator="÷"]')?.getAttribute('aria-label')).toBe(
            'Divide'
        );
    });

    it('keeps operators enabled before operands are selected', () => {
        const buttons = Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
        expect(buttons.every((button) => !button.disabled)).toBe(true);
    });

    it('emits operator-selected when an enabled operator is clicked', () => {
        el.setAttribute('left', '9');

        const handler = vi.fn();
        el.addEventListener('operator-selected', handler);

        const plusButton = el.querySelector('button[data-operator="+"]') as HTMLButtonElement;
        plusButton.click();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({ operator: '+' });
    });

    it('bubbles operator-selected event', () => {
        el.setAttribute('left', '9');

        const handler = vi.fn();
        document.body.addEventListener('operator-selected', handler);

        const plusButton = el.querySelector('button[data-operator="+"]') as HTMLButtonElement;
        plusButton.click();

        expect(handler).toHaveBeenCalledOnce();
        document.body.removeEventListener('operator-selected', handler);
    });

    it('enables subtraction when right operand is missing and left exists', () => {
        el.setAttribute('left', '9');

        const minusButton = el.querySelector('button[data-operator="-"]') as HTMLButtonElement;
        expect(minusButton.disabled).toBe(false);
    });

    it('enables division when right operand is missing and left exists', () => {
        el.setAttribute('left', '9');

        const divideButton = el.querySelector('button[data-operator="÷"]') as HTMLButtonElement;
        expect(divideButton.disabled).toBe(false);
    });

    it('enables subtraction when left > right', () => {
        el.setAttribute('left', '10');
        el.setAttribute('right', '3');

        const minusButton = el.querySelector('button[data-operator="-"]') as HTMLButtonElement;
        expect(minusButton.disabled).toBe(false);
    });

    it('disables subtraction when left <= right', () => {
        el.setAttribute('left', '3');
        el.setAttribute('right', '3');

        const minusButton = el.querySelector('button[data-operator="-"]') as HTMLButtonElement;
        expect(minusButton.disabled).toBe(true);
    });

    it('enables division only when exact integer division is possible', () => {
        el.setAttribute('left', '12');
        el.setAttribute('right', '3');

        const divideButton = el.querySelector('button[data-operator="÷"]') as HTMLButtonElement;
        expect(divideButton.disabled).toBe(false);
    });

    it('disables division when division would produce a remainder', () => {
        el.setAttribute('left', '10');
        el.setAttribute('right', '3');

        const divideButton = el.querySelector('button[data-operator="÷"]') as HTMLButtonElement;
        expect(divideButton.disabled).toBe(true);
    });

    it('disables all operators when locked', () => {
        el.setAttribute('locked', '');

        const buttons = Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
        expect(buttons).toHaveLength(4);
        expect(buttons.every((button) => button.disabled)).toBe(true);
    });

    it('moves focus with arrow keys across enabled operators', () => {
        const plus = el.querySelector('button[data-operator="+"]') as HTMLButtonElement;
        const minus = el.querySelector('button[data-operator="-"]') as HTMLButtonElement;

        plus.focus();
        plus.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

        expect(document.activeElement).toBe(minus);
    });
});
