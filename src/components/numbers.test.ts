import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NumberTokenElement } from './number.js';
import { NumbersPoolElement } from './numbers.js';

if (!customElements.get('number-token')) {
    customElements.define('number-token', NumberTokenElement);
}
if (!customElements.get('numbers-pool')) {
    customElements.define('numbers-pool', NumbersPoolElement);
}

describe('NumbersPoolElement', () => {
    let el: NumbersPoolElement;

    beforeEach(() => {
        el = document.createElement('numbers-pool') as NumbersPoolElement;
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
    });

    it('renders number-token elements from tokens JSON', () => {
        el.setAttribute(
            'tokens',
            JSON.stringify([
                { id: 'n1', value: 5, used: false },
                { id: 'n2', value: 50, used: true },
            ])
        );

        const tokens = el.querySelectorAll('number-token');
        expect(tokens).toHaveLength(2);
        expect(tokens[0].getAttribute('value')).toBe('5');
        expect(tokens[1].getAttribute('value')).toBe('50');
        expect(tokens[1].hasAttribute('used')).toBe(true);
    });

    it('updates rendered tokens when the tokens attribute changes', () => {
        el.setAttribute('tokens', JSON.stringify([{ id: 'n1', value: 1, used: false }]));
        expect(el.querySelectorAll('number-token')).toHaveLength(1);

        el.setAttribute(
            'tokens',
            JSON.stringify([
                { id: 'n1', value: 1, used: false },
                { id: 'n2', value: 2, used: false },
            ])
        );

        expect(el.querySelectorAll('number-token')).toHaveLength(2);
    });

    it('marks selected tokens using selected-token-ids', () => {
        el.setAttribute(
            'tokens',
            JSON.stringify([
                { id: 'n1', value: 1, used: false },
                { id: 'n2', value: 2, used: false },
            ])
        );
        el.setAttribute('selected-token-ids', JSON.stringify(['n2']));

        expect(el.querySelector('#n1')?.hasAttribute('selected')).toBe(false);
        expect(el.querySelector('#n2')?.hasAttribute('selected')).toBe(true);
    });

    it('returns empty render for malformed tokens JSON', () => {
        el.setAttribute('tokens', '{bad json');
        expect(el.querySelectorAll('number-token')).toHaveLength(0);
    });

    it('forwards bubbling number-selected events from child tokens', () => {
        el.setAttribute('tokens', JSON.stringify([{ id: 'n1', value: 8, used: false }]));

        const handler = vi.fn();
        el.addEventListener('number-selected', handler);

        const button = el.querySelector('button') as HTMLButtonElement;
        button.click();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({ id: 'n1', value: 8 });
    });

    it('locks all child tokens when pool is locked', () => {
        el.setAttribute(
            'tokens',
            JSON.stringify([
                { id: 'n1', value: 8, used: false },
                { id: 'n2', value: 9, used: false },
            ])
        );
        el.setAttribute('locked', '');

        const buttons = Array.from(el.querySelectorAll('button')) as HTMLButtonElement[];
        expect(buttons).toHaveLength(2);
        expect(buttons.every((button) => button.disabled)).toBe(true);
    });

    it('renders a grouped region label for assistive technology', () => {
        const pool = el.querySelector('.numbers-pool') as HTMLElement;
        expect(pool.getAttribute('role')).toBe('group');
        expect(pool.getAttribute('aria-label')).toBe('Available numbers');
    });

    it('moves focus with arrow keys across enabled number tokens', () => {
        el.setAttribute(
            'tokens',
            JSON.stringify([
                { id: 'n1', value: 8, used: false },
                { id: 'n2', value: 9, used: false },
            ])
        );

        const first = el.querySelector('#n1 button') as HTMLButtonElement;
        const second = el.querySelector('#n2 button') as HTMLButtonElement;

        first.focus();
        first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));

        expect(document.activeElement).toBe(second);
    });
});
