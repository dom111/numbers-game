import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NumberTokenElement } from './number.js';

if (!customElements.get('number-token')) {
    customElements.define('number-token', NumberTokenElement);
}

const make = (value: number, used = false, id = 'tok'): NumberTokenElement => {
    const el = document.createElement('number-token') as NumberTokenElement;
    el.id = id;
    el.setAttribute('value', String(value));
    if (used) el.setAttribute('used', '');
    return el;
};

describe('NumberTokenElement', () => {
    let el: NumberTokenElement;

    beforeEach(() => {
        el = make(5);
        document.body.appendChild(el);
    });
    afterEach(() => {
        el.remove();
    });

    describe('rendering', () => {
        it('renders a single button', () => {
            expect(el.querySelectorAll('button')).toHaveLength(1);
        });
        it('displays the correct value', () => {
            expect(el.querySelector('button')?.textContent).toBe('5');
        });
        it('re-renders when value attribute changes', () => {
            el.setAttribute('value', '100');
            expect(el.querySelector('button')?.textContent).toBe('100');
        });
    });

    describe('available state', () => {
        it('button is enabled', () => {
            expect(el.querySelector('button')?.disabled).toBe(false);
        });
        it('aria-pressed is false', () => {
            expect(el.querySelector('button')?.getAttribute('aria-pressed')).toBe('false');
        });

        it('includes an accessible label with value and availability', () => {
            expect(el.querySelector('button')?.getAttribute('aria-label')).toBe(
                'Number 5, available'
            );
        });
    });

    describe('used state', () => {
        beforeEach(() => {
            el.setAttribute('used', '');
        });
        it('button is disabled', () => {
            expect(el.querySelector('button')?.disabled).toBe(true);
        });
        it('aria-pressed is true', () => {
            expect(el.querySelector('button')?.getAttribute('aria-pressed')).toBe('true');
        });
        it('updates accessible label to unavailable', () => {
            expect(el.querySelector('button')?.getAttribute('aria-label')).toBe(
                'Number 5, unavailable'
            );
        });
        it('reverts to enabled when used attribute is removed', () => {
            el.removeAttribute('used');
            expect(el.querySelector('button')?.disabled).toBe(false);
        });
    });

    it('uses custom aria-label when provided', () => {
        el.setAttribute('aria-label', 'Target 175');
        el.setAttribute('value', '175');
        expect(el.querySelector('button')?.getAttribute('aria-label')).toBe('Target 175');
    });

    describe('locked state', () => {
        beforeEach(() => {
            el.setAttribute('locked', '');
        });

        it('button is disabled while locked', () => {
            expect(el.querySelector('button')?.disabled).toBe(true);
        });

        it('does not fire when token is locked', () => {
            const fn = vi.fn();
            el.addEventListener('number-selected', fn);
            el.querySelector('button')?.click();
            expect(fn).not.toHaveBeenCalled();
        });
    });

    describe('number-selected event', () => {
        it('fires when available token is clicked', () => {
            const fn = vi.fn();
            el.addEventListener('number-selected', fn);
            el.querySelector('button')?.click();
            expect(fn).toHaveBeenCalledOnce();
        });
        it('payload contains correct id and value', () => {
            const fn = vi.fn();
            el.addEventListener('number-selected', fn);
            el.querySelector('button')?.click();
            expect(fn.mock.calls[0][0].detail).toEqual({ id: 'tok', value: 5 });
        });
        it('event bubbles', () => {
            const fn = vi.fn();
            document.body.addEventListener('number-selected', fn);
            el.querySelector('button')?.click();
            expect(fn).toHaveBeenCalledOnce();
            document.body.removeEventListener('number-selected', fn);
        });
        it('does not fire when token is used', () => {
            el.setAttribute('used', '');
            const fn = vi.fn();
            el.addEventListener('number-selected', fn);
            el.querySelector('button')?.click();
            expect(fn).not.toHaveBeenCalled();
        });
        it('payload reflects updated value after attribute change', () => {
            el.setAttribute('value', '75');
            const fn = vi.fn();
            el.addEventListener('number-selected', fn);
            el.querySelector('button')?.click();
            expect(fn.mock.calls[0][0].detail).toEqual({ id: 'tok', value: 75 });
        });
    });
});
