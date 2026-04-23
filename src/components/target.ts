/**
 * @purpose Displays the non-interactive target number for the current round.
 * @inputs
 * - `value` — the target integer for the active game; a whole positive integer in the range 1–999.
 * - Optional `celebrating` — present only immediately after a win to enable decorative target animation.
 *
 * @outputs None; this component is display-only.
 *
 * @invariants
 * - Target value is immutable for the duration of a round; it only changes when a new game starts.
 * - Renders a `Number` component in a non-interactive (disabled) state.
 */

import './number.js';

export class TargetNumberElement extends HTMLElement {
    static readonly observedAttributes = ['value', 'celebrating'] as const;

    connectedCallback(): void {
        this.render();
    }

    attributeChangedCallback(): void {
        this.render();
    }

    private render(): void {
        const value = this.getAttribute('value') ?? '';
        const token = document.createElement('number-token');
        token.setAttribute('value', value);
        token.setAttribute('used', '');
        token.setAttribute('aria-label', `Target ${value}`);
        this.replaceChildren(token);
    }
}

customElements.define('target-number', TargetNumberElement);
