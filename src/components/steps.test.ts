import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { OperatorButtonsElement } from './operators.js';
import { StepEquationElement } from './step.js';
import { StepsListElement } from './steps.js';

if (!customElements.get('operator-buttons')) {
    customElements.define('operator-buttons', OperatorButtonsElement);
}
if (!customElements.get('step-equation')) {
    customElements.define('step-equation', StepEquationElement);
}
if (!customElements.get('steps-list')) {
    customElements.define('steps-list', StepsListElement);
}

describe('StepsListElement', () => {
    let el: StepsListElement;

    beforeEach(() => {
        el = document.createElement('steps-list') as StepsListElement;
        document.body.appendChild(el);
    });

    afterEach(() => {
        el.remove();
    });

    it('renders one active step when no history is provided', () => {
        const allSteps = el.querySelectorAll('step-equation');
        expect(allSteps).toHaveLength(1);

        const active = el.querySelector('step-equation[data-role="active"]');
        expect(active).not.toBeNull();
    });

    it('renders completed steps from the steps JSON plus an active step', () => {
        el.setAttribute(
            'steps',
            JSON.stringify([{ id: 'step-1', left: 5, operator: '×', right: 50, value: 250 }])
        );

        const allSteps = el.querySelectorAll('step-equation');
        expect(allSteps).toHaveLength(2);

        const completed = el.querySelector('step-equation[locked]');
        expect(completed).not.toBeNull();
        expect(completed?.getAttribute('left')).toBe('5');

        const removeButton = el.querySelector('button[data-remove-step-id="step-1"]');
        expect(removeButton?.textContent).toBe('×');
        expect(removeButton?.getAttribute('aria-label')).toBe('Remove step-1');
    });

    it('renders steps container with list semantics', () => {
        const list = el.querySelector('.steps-list') as HTMLElement;
        expect(list.getAttribute('role')).toBe('list');
        expect(list.getAttribute('aria-label')).toBe('Completed and active steps');
    });

    it('fills active step operands from number-selected/operator-selected events', () => {
        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n1', value: 250 },
            })
        );

        const active = el.querySelector('step-equation[data-role="active"]') as HTMLElement;
        expect(active.getAttribute('left')).toBe('250');

        el.dispatchEvent(
            new CustomEvent('operator-selected', {
                bubbles: true,
                detail: { operator: '-' },
            })
        );

        const activeAfterOperator = el.querySelector(
            'step-equation[data-role="active"]'
        ) as HTMLElement;
        expect(activeAfterOperator.getAttribute('operator')).toBe('-');

        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n2', value: 500 },
            })
        );

        const activeAfterRight = el.querySelector(
            'step-equation[data-role="active"]'
        ) as HTMLElement;
        expect(activeAfterRight.getAttribute('id')).toBe('step-1');
        expect(activeAfterRight.getAttribute('operator')).toBe('-');
        expect(activeAfterRight.getAttribute('right')).toBe('500');
    });

    it('allows removing selected numbers by clicking the same token again', () => {
        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n1', value: 50 },
            })
        );

        let active = el.querySelector('step-equation[data-role="active"]') as HTMLElement;
        expect(active.getAttribute('left')).toBe('50');

        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n1', value: 50 },
            })
        );

        active = el.querySelector('step-equation[data-role="active"]') as HTMLElement;
        expect(active.getAttribute('left')).toBeNull();
    });

    it('keeps selected operator when left operand is removed', () => {
        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n1', value: 50 },
            })
        );

        el.dispatchEvent(
            new CustomEvent('operator-selected', {
                bubbles: true,
                detail: { operator: '-' },
            })
        );

        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n1', value: 50 },
            })
        );

        const active = el.querySelector('step-equation[data-role="active"]') as HTMLElement;
        expect(active.getAttribute('left')).toBeNull();
        expect(active.getAttribute('operator')).toBe('-');
    });

    it('removes right operand when clicking the right chip in active step', () => {
        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n1', value: 50 },
            })
        );
        el.dispatchEvent(
            new CustomEvent('operator-selected', {
                bubbles: true,
                detail: { operator: '-' },
            })
        );
        el.dispatchEvent(
            new CustomEvent('number-selected', {
                bubbles: true,
                detail: { id: 'n2', value: 75 },
            })
        );

        const active = el.querySelector('step-equation[data-role="active"]') as HTMLElement;
        const rightChip = active.querySelector(
            'button.step-chip[data-slot="right"]'
        ) as HTMLButtonElement;
        rightChip.click();

        const activeAfterRemove = el.querySelector(
            'step-equation[data-role="active"]'
        ) as HTMLElement;
        expect(activeAfterRemove.getAttribute('right')).toBeNull();
    });

    it('emits steps-changed when active step completes and starts a new active step', () => {
        const handler = vi.fn();
        el.addEventListener('steps-changed', handler);

        const active = el.querySelector('step-equation[data-role="active"]') as HTMLElement;
        const activeId = active.getAttribute('id') as string;

        active.dispatchEvent(
            new CustomEvent('step-complete', {
                bubbles: true,
                detail: { id: activeId, left: 250, operator: '-', right: 75, value: 175 },
            })
        );

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({
            steps: [{ id: activeId, left: 250, operator: '-', right: 75, value: 175 }],
        });

        const completed = el.querySelectorAll('step-equation[locked]');
        const activeSteps = el.querySelectorAll('step-equation[data-role="active"]');
        expect(completed).toHaveLength(1);
        expect(activeSteps).toHaveLength(1);
        expect((activeSteps[0] as HTMLElement).getAttribute('id')).toBe('step-2');
    });

    it('removes the selected step and all subsequent steps', () => {
        el.setAttribute(
            'steps',
            JSON.stringify([
                { id: 'step-1', left: 75, operator: '-', right: 50, value: 25 },
                { id: 'step-2', left: 9, operator: '×', right: 25, value: 225 },
            ])
        );

        const handler = vi.fn();
        el.addEventListener('steps-changed', handler);

        const removeStepOneButton = el.querySelector(
            'button[data-remove-step-id="step-1"]'
        ) as HTMLButtonElement;
        removeStepOneButton.click();

        expect(handler).toHaveBeenCalledOnce();
        expect(handler.mock.calls[0][0].detail).toEqual({ steps: [] });

        const completed = el.querySelectorAll('step-equation[locked]');
        const activeSteps = el.querySelectorAll('step-equation[data-role="active"]');
        expect(completed).toHaveLength(0);
        expect(activeSteps).toHaveLength(1);
        expect((activeSteps[0] as HTMLElement).getAttribute('id')).toBe('step-1');
    });

    it('disables remove controls when locked', () => {
        el.setAttribute(
            'steps',
            JSON.stringify([{ id: 'step-1', left: 75, operator: '-', right: 50, value: 25 }])
        );
        el.setAttribute('locked', '');

        const handler = vi.fn();
        el.addEventListener('steps-changed', handler);

        const removeButton = el.querySelector(
            'button[data-remove-step-id="step-1"]'
        ) as HTMLButtonElement;
        expect(removeButton.disabled).toBe(true);

        removeButton.click();
        expect(handler).not.toHaveBeenCalled();
    });

    it('highlights only the rollback-suggested completed step', () => {
        el.setAttribute(
            'steps',
            JSON.stringify([
                { id: 'step-1', left: 75, operator: '-', right: 50, value: 25 },
                { id: 'step-2', left: 9, operator: '×', right: 25, value: 225 },
            ])
        );
        el.setAttribute('rollback-step-id', 'step-2');

        const highlightedRow = el.querySelector('.step-row.rollback-suggested') as HTMLElement;
        expect(highlightedRow.querySelector('step-equation')?.getAttribute('id')).toBe('step-2');

        const highlightedRemoveButton = el.querySelector(
            'button[data-remove-step-id="step-2"]'
        ) as HTMLButtonElement;
        expect(highlightedRemoveButton.classList.contains('rollback-suggested')).toBe(true);

        const nonHighlightedRow = el.querySelector(
            '.step-row:not(.rollback-suggested) step-equation[id="step-1"]'
        ) as HTMLElement;
        expect(nonHighlightedRow).not.toBeNull();

        const nonHighlightedRemoveButton = el.querySelector(
            'button[data-remove-step-id="step-1"]'
        ) as HTMLButtonElement;
        expect(nonHighlightedRemoveButton.classList.contains('rollback-suggested')).toBe(false);
    });

    it('does not render an active step when locked', () => {
        el.setAttribute(
            'steps',
            JSON.stringify([{ id: 'step-1', left: 75, operator: '-', right: 50, value: 25 }])
        );
        el.setAttribute('locked', '');

        expect(el.querySelectorAll('step-equation[locked]')).toHaveLength(1);
        expect(el.querySelector('step-equation[data-role="active"]')).toBeNull();
    });
});
