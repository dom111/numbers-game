/**
 * @purpose Renders one selectable number token used in gameplay.
 *
 * @inputs
 * - `value` — the whole positive integer (≥ 1) this token represents.
 * - `id`    — a unique identifier so duplicate numeric values remain distinguishable.
 * - `used`  — boolean flag; when true the token is disabled and non-interactive.
 *
 * @fires `number-selected`
 *   Dispatched when an available token is clicked.
 *   Payload: `NumberSelectedPayload` — `{ id: string, value: number }`
 *   Bubbles: yes.
 *
 * @invariants
 * - `value` is always a whole positive integer (≥ 1).
 * - Available tokens are visually interactive (blue).
 * - Used tokens are visually disabled (light grey) and do not fire events.
 * - Identity is tracked by `id`, not by `value` alone; two tokens may share a value but never an id.
 * - The `used` state is permanent within a round; it cannot be reversed except by a game reset or new game.
 */

import type { NumberSelectedPayload } from '../types.js';

export class NumberTokenElement extends HTMLElement {
    static readonly observedAttributes = [
        'value',
        'used',
        'selected',
        'locked',
        'aria-label',
    ] as const;

    connectedCallback(): void {
        this.render();
    }

    attributeChangedCallback(): void {
        this.render();
    }

    private get tokenValue(): number {
        return parseInt(this.getAttribute('value') ?? '0', 10);
    }

    private get isUsed(): boolean {
        return this.hasAttribute('used');
    }

    private get isSelected(): boolean {
        return this.hasAttribute('selected');
    }

    private get isLocked(): boolean {
        return this.hasAttribute('locked');
    }

    private render(): void {
        const button = document.createElement('button');
        button.className = 'number-token';
        if (this.isSelected && !this.isUsed && !this.isLocked) {
            button.classList.add('is-selected');
        }
        button.textContent = String(this.tokenValue);
        button.disabled = this.isUsed || this.isLocked;
        button.setAttribute('aria-pressed', String(this.isUsed));
        const customAriaLabel = this.getAttribute('aria-label');
        if (customAriaLabel) {
            button.setAttribute('aria-label', customAriaLabel);
        } else {
            const statusLabel =
                this.isUsed || this.isLocked
                    ? 'unavailable'
                    : this.isSelected
                      ? 'selected'
                      : 'available';
            button.setAttribute('aria-label', `Number ${this.tokenValue}, ${statusLabel}`);
        }

        if (!this.isUsed && !this.isLocked) {
            button.addEventListener('click', () => {
                const payload: NumberSelectedPayload = { id: this.id, value: this.tokenValue };
                this.dispatchEvent(
                    new CustomEvent<NumberSelectedPayload>('number-selected', {
                        bubbles: true,
                        detail: payload,
                    })
                );
            });
        }

        this.replaceChildren(button);
    }
}

customElements.define('number-token', NumberTokenElement);
