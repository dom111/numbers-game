/**
 * @purpose Presents available arithmetic operators for the active `Step`.
 *
 * @inputs
 * - Current active `Step` operand state, used to determine which operators are valid.
 *
 * @fires `operator-selected`
 *   Dispatched when an operator button is clicked.
 *   Payload: `OperatorSelectedPayload` — `{ operator: Operator }`
 *   Bubbles: yes.
 *
 * @invariants
 * - Only four operators are available: `+`, `-`, `×`, `÷`.
 * - Operators are never consumed; the same operator may be used in any number of steps.
 * - Operators may be selected before both operands are chosen.
 * - `÷` is disabled only when both operands are present and division would produce a non-integer result.
 * - `-` is disabled only when both operands are present and subtraction would produce a non-positive result.
 * - Operators use display symbols, not JS operator characters, to keep rendering decoupled from evaluation.
 */

import type { Operator, OperatorSelectedPayload } from '../types.js';

const OPERATORS: Operator[] = ['+', '-', '×', '÷'];

const parsePositiveInt = (value: string | null): number | null => {
    if (value === null) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

export class OperatorButtonsElement extends HTMLElement {
    static readonly observedAttributes = ['left', 'right', 'locked'] as const;

    private get isLocked(): boolean {
        return this.hasAttribute('locked');
    }

    connectedCallback(): void {
        this.render();
    }

    attributeChangedCallback(): void {
        this.render();
    }

    private get leftValue(): number | null {
        return parsePositiveInt(this.getAttribute('left'));
    }

    private get rightValue(): number | null {
        return parsePositiveInt(this.getAttribute('right'));
    }

    private isDisabled(operator: Operator): boolean {
        const left = this.leftValue;
        const right = this.rightValue;

        if (operator === '-') {
            if (left === null || right === null) return false;
            return left <= right;
        }

        if (operator === '÷') {
            if (left === null || right === null) return false;
            return left % right !== 0;
        }

        return false;
    }

    private render(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'operators';

        for (const operator of OPERATORS) {
            const button = document.createElement('button');
            button.className = 'operator-button';
            button.type = 'button';
            button.textContent = operator;
            button.dataset.operator = operator;
            button.disabled = this.isLocked || this.isDisabled(operator);

            if (!button.disabled) {
                button.addEventListener('click', () => {
                    const detail: OperatorSelectedPayload = { operator };
                    this.dispatchEvent(
                        new CustomEvent<OperatorSelectedPayload>('operator-selected', {
                            bubbles: true,
                            detail,
                        })
                    );
                });
            }

            wrapper.append(button);
        }

        this.replaceChildren(wrapper);
    }
}

customElements.define('operator-buttons', OperatorButtonsElement);
