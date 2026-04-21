/**
 * @purpose Represents one arithmetic operation in the player's solution path.
 *
 * @inputs
 * - `id`       — unique identifier for this step.
 * - `left`     — the left-hand operand; a whole positive integer (≥ 1).
 * - `operator` — one of `Operator`: `'+'`, `'-'`, `'×'`, `'÷'`.
 * - `right`    — the right-hand operand; a whole positive integer (≥ 1).
 *
 * @fires `step-complete`
 *   Dispatched when all three of `left`, `operator`, and `right` are set and the result is valid.
 *   Payload: `StepCompletePayload` — `{ id, left, operator, right, value }`
 *   Bubbles: yes.
 *
 * @fires `step-cleared`
 *   Dispatched when a step's inputs are cleared/reset before completion.
 *   Payload: `StepClearedPayload` — `{ id: string }`
 *   Bubbles: yes.
 *
 * @example
 *   // Step 1: two starting tokens are consumed, producing a new token with value 250.
 *   { left: 5, operator: '×', right: 50 }  →  value: 250
 *
 *   // Step 2: the result token (250) and a starting token (75) are consumed,
 *   // producing a new token with value 175.
 *   { left: 250, operator: '-', right: 75 }  →  value: 175
 *
 *   The value 175 is then available as a token for any further steps.
 *
 * @invariants
 * - Input order is flexible: `left/right/operator`, `operator/left/right`, and `left/operator/right`
 *   all evaluate once all three fields are present.
 * - A step is complete only when `left`, `operator`, and `right` are all present and valid.
 * - Both operands are whole positive integers (≥ 1).
 * - `÷` is only valid when `left % right === 0`.
 * - `-` is only valid when `left > right` (so `value ≥ 1`).
 * - The computed `value` is always a whole positive integer (≥ 1) when the step is valid.
 * - Complete-but-invalid expressions render as `= Error` and do not emit `step-complete`.
 * - The `value` is not provisional — it only exists once the step is complete and valid.
 */

import type { Operator, StepClearedPayload, StepCompletePayload } from '../types.js';

const parsePositiveInt = (value: string | null): number | null => {
    if (value === null) return null;
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

const parseOperator = (value: string | null): Operator | null => {
    if (value === '+' || value === '-' || value === '×' || value === '÷') return value;
    return null;
};

const evaluate = (left: number, operator: Operator, right: number): number | null => {
    if (left < 1 || right < 1) return null;

    switch (operator) {
        case '+':
            return left + right;
        case '×':
            return left * right;
        case '-':
            return left > right ? left - right : null;
        case '÷':
            return left % right === 0 ? left / right : null;
        default:
            return null;
    }
};

export class StepEquationElement extends HTMLElement {
    static readonly observedAttributes = [
        'left',
        'operator',
        'right',
        'left-token-id',
        'right-token-id',
        'locked',
    ] as const;

    private lastCompleteKey: string | null = null;

    connectedCallback(): void {
        this.sync();
    }

    attributeChangedCallback(): void {
        this.sync();
    }

    private get stepId(): string {
        return this.id || this.getAttribute('step-id') || '';
    }

    private get leftValue(): number | null {
        return parsePositiveInt(this.getAttribute('left'));
    }

    private get rightValue(): number | null {
        return parsePositiveInt(this.getAttribute('right'));
    }

    private get operatorValue(): Operator | null {
        return parseOperator(this.getAttribute('operator'));
    }

    private getCompletePayload(): StepCompletePayload | null {
        const left = this.leftValue;
        const right = this.rightValue;
        const operator = this.operatorValue;

        if (left === null || right === null || operator === null) return null;

        const value = evaluate(left, operator, right);
        if (value === null || value < 1 || !Number.isInteger(value)) return null;

        return {
            id: this.stepId,
            left,
            operator,
            right,
            value,
        };
    }

    private sync(): void {
        const completePayload = this.getCompletePayload();
        const hasFullExpression =
            this.leftValue !== null && this.operatorValue !== null && this.rightValue !== null;
        const hasError = hasFullExpression && completePayload === null;
        this.render(completePayload, hasError);
        this.emitStepEvents(completePayload);
    }

    private emitStepEvents(completePayload: StepCompletePayload | null): void {
        // Attribute updates can occur before the element is attached; emit only once connected.
        if (!this.isConnected) return;

        if (completePayload) {
            const nextKey = JSON.stringify(completePayload);
            if (nextKey !== this.lastCompleteKey) {
                this.dispatchEvent(
                    new CustomEvent<StepCompletePayload>('step-complete', {
                        bubbles: true,
                        detail: completePayload,
                    })
                );
                this.lastCompleteKey = nextKey;
            }
            return;
        }

        if (this.lastCompleteKey !== null) {
            const detail: StepClearedPayload = { id: this.stepId };
            this.dispatchEvent(
                new CustomEvent<StepClearedPayload>('step-cleared', {
                    bubbles: true,
                    detail,
                })
            );
            this.lastCompleteKey = null;
        }
    }

    private render(completePayload: StepCompletePayload | null, hasError: boolean): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'step';

        const expressionLine = document.createElement('p');
        expressionLine.className = 'step-expression-line';

        const expression = document.createElement('span');
        expression.className = 'step-expression';

        const appendOperandChip = (slot: 'left' | 'right'): void => {
            const value = this.getAttribute(slot);
            const tokenId = this.getAttribute(`${slot}-token-id`);
            const label = value ?? '•';

            if (!this.hasAttribute('locked') && value !== null && tokenId) {
                const chip = document.createElement('button');
                chip.type = 'button';
                chip.className = 'step-chip';
                chip.dataset.slot = slot;
                chip.textContent = label;
                chip.addEventListener('click', () => {
                    this.dispatchEvent(
                        new CustomEvent('step-token-remove', {
                            bubbles: true,
                            detail: { slot, tokenId },
                        })
                    );
                });
                expression.append(chip);
                return;
            }

            const text = document.createElement('span');
            text.textContent = label;
            expression.append(text);
        };

        appendOperandChip('left');
        expression.append(` ${this.getAttribute('operator') ?? '•'} `);
        appendOperandChip('right');

        const value = document.createElement('span');
        value.className = 'step-value';
        if (hasError) {
            value.classList.add('error');
        }
        value.textContent = completePayload
            ? `= ${completePayload.value}`
            : hasError
              ? '= Error'
              : '= ?';

        expressionLine.append(expression, ' ', value);
        wrapper.append(expressionLine);

        this.replaceChildren(wrapper);
    }
}

customElements.define('step-equation', StepEquationElement);
