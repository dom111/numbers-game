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
    static readonly observedAttributes = ['tokens'] as const;

    connectedCallback(): void {
        this.render();
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

    private render(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'numbers-pool';

        for (const token of this.tokens) {
            const element = document.createElement('number-token');
            element.id = token.id;
            element.setAttribute('value', String(token.value));
            if (token.used) {
                element.setAttribute('used', '');
            }
            wrapper.append(element);
        }

        this.replaceChildren(wrapper);
    }
}

customElements.define('numbers-pool', NumbersPoolElement);
