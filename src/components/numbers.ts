/**
 * @purpose Displays the collection of starting and derived number tokens for the current round.
 *
 * @inputs
 * - An ordered set of `NumberToken` objects, each with a unique `id`, a `value`, and a `used` flag.
 * - Starting tokens are generated or provided at round start; derived tokens come from completed `Step` results.
 *
 * @outputs
 * - Forwards `number-selected` events from child `Number` tokens up to the active `Step`.
 *
 * @invariants
 * - A round starts with exactly six tokens.
 * - Derived tokens (step results) are appended as new single-use tokens with fresh ids.
 * - The pool grows and shrinks as steps are completed: each step consumes two tokens and produces one.
 * - A new step can be started whenever at least two tokens remain available.
 */

import './number.js';
import type { NumberToken } from '../types.js';

const parseTokens = (raw: string | null): NumberToken[] => {
    if (!raw) return [];

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed
            .filter((token): token is NumberToken => {
                if (!token || typeof token !== 'object') return false;
                const candidate = token as Partial<NumberToken>;
                return (
                    typeof candidate.id === 'string' &&
                    typeof candidate.value === 'number' &&
                    Number.isInteger(candidate.value) &&
                    candidate.value >= 1 &&
                    typeof candidate.used === 'boolean'
                );
            })
            .map((token) => ({ ...token }));
    } catch {
        return [];
    }
};

export class NumbersPoolElement extends HTMLElement {
    static readonly observedAttributes = ['tokens', 'locked'] as const;

    private get isLocked(): boolean {
        return this.hasAttribute('locked');
    }

    connectedCallback(): void {
        this.addEventListener('keydown', this.onKeyDown as EventListener);
        this.render();
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this.onKeyDown as EventListener);
    }

    attributeChangedCallback(): void {
        this.render();
    }

    get tokens(): NumberToken[] {
        return parseTokens(this.getAttribute('tokens'));
    }

    set tokens(value: NumberToken[]) {
        this.setAttribute('tokens', JSON.stringify(value));
    }

    private onKeyDown = (event: KeyboardEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;

        const isHorizontalKey = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
        const isVerticalKey = event.key === 'ArrowUp' || event.key === 'ArrowDown';
        const isHomeEnd = event.key === 'Home' || event.key === 'End';
        if (!isHorizontalKey && !isVerticalKey && !isHomeEnd) return;

        const enabledButtons = Array.from(
            this.querySelectorAll<HTMLButtonElement>('.number-token')
        ).filter((button) => !button.disabled);
        if (enabledButtons.length < 2) return;

        const currentIndex = enabledButtons.indexOf(target);
        if (currentIndex < 0) return;

        event.preventDefault();

        if (event.key === 'Home') {
            enabledButtons[0].focus();
            return;
        }
        if (event.key === 'End') {
            enabledButtons[enabledButtons.length - 1].focus();
            return;
        }

        const delta = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1;
        const nextIndex = (currentIndex + delta + enabledButtons.length) % enabledButtons.length;
        enabledButtons[nextIndex].focus();
    };

    private render(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'numbers-pool';
        wrapper.setAttribute('role', 'group');
        wrapper.setAttribute('aria-label', 'Available numbers');

        for (const token of this.tokens) {
            const element = document.createElement('number-token');
            element.id = token.id;
            element.setAttribute('value', String(token.value));
            if (token.used) {
                element.setAttribute('used', '');
            }
            if (this.isLocked) {
                element.setAttribute('locked', '');
            }
            wrapper.append(element);
        }

        this.replaceChildren(wrapper);
    }
}

customElements.define('numbers-pool', NumbersPoolElement);
