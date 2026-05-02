import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HintLevel } from '../lib/hint-engine.js';
import { HintPanelElement } from './hint-panel.js';

if (!customElements.get('hint-panel')) {
    customElements.define('hint-panel', HintPanelElement);
}

describe('HintPanelElement', () => {
    let el: HintPanelElement;

    beforeEach(() => {
        el = document.createElement('hint-panel') as HintPanelElement;
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
    });

    it('renders without error when no attributes are set', () => {
        expect(el.querySelector('.hint-panel')).not.toBeNull();
    });

    it('displays a NextOperands hint when hint-level is set', () => {
        el.setAttribute('numbers', JSON.stringify([5, 50]));
        el.setAttribute('target', '250');
        el.setAttribute('hint-level', HintLevel.NextOperands);

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Try using');
        expect(text).toContain('5');
        expect(text).toContain('50');
    });

    it('displays a NextOperator hint with operator symbol', () => {
        el.setAttribute('numbers', JSON.stringify([5, 50]));
        el.setAttribute('target', '250');
        el.setAttribute('hint-level', HintLevel.NextOperator);

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('5');
        expect(text).toContain('×');
        expect(text).toContain('50');
    });

    it('displays a FullSolution hint with all steps', () => {
        el.setAttribute('numbers', JSON.stringify([5, 50, 75]));
        el.setAttribute('target', '175');
        el.setAttribute('hint-level', HintLevel.FullSolution);

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Full solution');
        expect(text).toContain('175');
    });

    it('shows "no hint available" for unsolvable states', () => {
        el.setAttribute('numbers', JSON.stringify([2, 3]));
        el.setAttribute('target', '7');
        el.setAttribute('hint-level', HintLevel.NextOperands);

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('No hint available');
    });

    it('uses only provided available numbers (including derived results)', () => {
        // The derived 250 result must already be in available numbers for hints to use it.
        el.setAttribute('numbers', JSON.stringify([9, 25, 250]));
        el.setAttribute('target', '225');
        el.setAttribute('hint-level', HintLevel.NextOperands);

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Try using');
        expect(text).toContain('250');
        expect(text).toContain('25');
    });

    it('updates hint when numbers attribute changes', () => {
        el.setAttribute('numbers', JSON.stringify([1, 2]));
        el.setAttribute('target', '3');
        el.setAttribute('hint-level', HintLevel.NextOperands);

        let text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Try using');

        el.setAttribute('numbers', JSON.stringify([5, 50]));
        el.setAttribute('target', '250');
        text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Try using');
    });

    it('updates hint when hint-level attribute changes', () => {
        el.setAttribute('numbers', JSON.stringify([5, 50]));
        el.setAttribute('target', '250');

        el.setAttribute('hint-level', HintLevel.NextOperands);
        let text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Try using');

        el.setAttribute('hint-level', HintLevel.NextOperator);
        text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('×');
    });

    it('defaults to NextOperands hint level when not specified', () => {
        el.setAttribute('numbers', JSON.stringify([5, 50]));
        el.setAttribute('target', '250');

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Try using');
    });

    it('filters non-numeric and invalid numbers from the numbers attribute', () => {
        el.setAttribute('numbers', JSON.stringify([5, '50', 'oops', -3, 0, 7.2]));
        el.setAttribute('target', '250');
        el.setAttribute('hint-level', HintLevel.NextOperands);

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('Try using');
        expect(text).toContain('5');
        expect(text).toContain('50');
    });

    it('treats an invalid target attribute as unsolved/no hint', () => {
        el.setAttribute('numbers', JSON.stringify([5, 50]));
        el.setAttribute('target', 'not-a-number');
        el.setAttribute('hint-level', HintLevel.NextOperands);

        const text = el.querySelector('.hint-text')?.textContent;
        expect(text).toContain('No hint available');
    });
});
