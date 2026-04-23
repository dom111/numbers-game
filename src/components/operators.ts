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

const OPERATOR_ARIA_LABELS: Record<Operator, string> = {
    '+': 'Add',
    '-': 'Subtract',
    '×': 'Multiply',
    '÷': 'Divide',
};

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
        this.addEventListener('keydown', this.onKeyDown as EventListener);
        this.render();
    }

    disconnectedCallback(): void {
        this.removeEventListener('keydown', this.onKeyDown as EventListener);
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

    private onKeyDown = (event: KeyboardEvent): void => {
        const target = event.target;
        if (!(target instanceof HTMLButtonElement)) return;

        const isArrowKey = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
        const isHomeEnd = event.key === 'Home' || event.key === 'End';
        if (!isArrowKey && !isHomeEnd) return;

        const enabledButtons = Array.from(
            this.querySelectorAll<HTMLButtonElement>('.operator-button')
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

        const delta = event.key === 'ArrowRight' ? 1 : -1;
        const nextIndex = (currentIndex + delta + enabledButtons.length) % enabledButtons.length;
        enabledButtons[nextIndex].focus();
    };

    private render(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'operators';
        wrapper.setAttribute('role', 'group');
        wrapper.setAttribute('aria-label', 'Operators');

        for (const operator of OPERATORS) {
            const button = document.createElement('button');
            button.className = 'operator-button';
            button.type = 'button';
            button.textContent = operator;
            button.dataset.operator = operator;
            button.disabled = this.isLocked || this.isDisabled(operator);
            button.setAttribute('aria-label', OPERATOR_ARIA_LABELS[operator]);

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
