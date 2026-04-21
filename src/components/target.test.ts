import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NumberTokenElement } from './number.js';
import { TargetNumberElement } from './target.js';

if (!customElements.get('number-token')) {
    customElements.define('number-token', NumberTokenElement);
}
if (!customElements.get('target-number')) {
    customElements.define('target-number', TargetNumberElement);
}

describe('TargetNumberElement', () => {
    let el: TargetNumberElement;

    beforeEach(() => {
        el = document.createElement('target-number') as TargetNumberElement;
        el.setAttribute('value', '175');
        document.body.appendChild(el);
    });
    afterEach(() => {
        el.remove();
    });

    it('renders a number-token child', () => {
        expect(el.querySelector('number-token')).not.toBeNull();
    });
    it('passes the correct value to the number-token', () => {
        expect(el.querySelector('number-token')?.getAttribute('value')).toBe('175');
    });
    it('number-token is always marked as used', () => {
        expect(el.querySelector('number-token')?.hasAttribute('used')).toBe(true);
    });
    it('inner button is disabled (non-interactive)', () => {
        expect(el.querySelector('button')?.disabled).toBe(true);
    });
    it('does not fire number-selected when inner button is clicked', () => {
        const fn = vi.fn();
        el.addEventListener('number-selected', fn);
        el.querySelector('button')?.click();
        expect(fn).not.toHaveBeenCalled();
    });
    it('re-renders with updated value when attribute changes', () => {
        el.setAttribute('value', '999');
        expect(el.querySelector('number-token')?.getAttribute('value')).toBe('999');
    });
});
