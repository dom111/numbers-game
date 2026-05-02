/**
 * @purpose Stores and renders the ordered list of player-created `Step` items.
 *
 * @inputs
 * - History of `StepData[]` records.
 * - Index of the currently active (incomplete) step.
 *
 * @fires `steps-changed`
 *   Dispatched when the step list is created, updated, or a step is finalized.
 *   Payload: `StepsChangedPayload` — `{ steps: StepData[] }`
 *   Bubbles: yes.
 *
 * @invariants
 * - Only one step is active at a time; it is always the most recently created incomplete step.
 * - Active-step inputs may be supplied in any of these orders: `left/right/operator`,
 *   `operator/left/right`, or `left/operator/right`.
 * - When a step is completed, its `value` is immediately added to the available token pool as a
 *   new single-use token, and the two tokens consumed as operands are marked as used.
 * - A result token behaves identically to a starting token: it has a unique `id`, a `value`,
 *   and can be selected as the `left` or `right` operand of any subsequent step.
 * - Clicking an assigned operand chip in the active step removes that operand assignment.
 * - A token produced by a step may only be used once; it is consumed when selected in a subsequent step.
 * - Removing a completed step truncates history at that point, removing the selected step and every
 *   subsequent step so no later step can reference a removed result token.
 * - There is no limit on the number of steps; the player may keep adding steps for as long as
 *   there are at least two available tokens remaining.
 * - A complete-but-invalid expression remains active and displays an error state; it is not added
 *   to history and does not emit `steps-changed`.
 * - Not all steps need to be completed, and not all tokens need to be used.
 */

import './step.js';
import type {
    Operator,
    NumberSelectedPayload,
    OperatorSelectedPayload,
    StepData,
    StepsChangedPayload,
} from '../types.js';

const parseSteps = (raw: string | null): StepData[] => {
    if (!raw) return [];

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];

        return parsed.filter((step): step is StepData => {
            if (!step || typeof step !== 'object') return false;
            const candidate = step as Partial<StepData>;
            return (
                typeof candidate.id === 'string' &&
                typeof candidate.left === 'number' &&
                typeof candidate.right === 'number' &&
                typeof candidate.value === 'number' &&
                (candidate.operator === '+' ||
                    candidate.operator === '-' ||
                    candidate.operator === '×' ||
                    candidate.operator === '÷')
            );
        });
    } catch {
        return [];
    }
};

const parsePositiveInt = (value: unknown): number | null => {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1 ? value : null;
};

const parseOperator = (value: unknown): Operator | null => {
    return value === '+' || value === '-' || value === '×' || value === '÷' ? value : null;
};

type ActiveStep = {
    id: string;
    left: number | null;
    leftTokenId: string | null;
    operator: string | null;
    right: number | null;
    rightTokenId: string | null;
};

type StepTokenRemovePayload = {
    slot: 'left' | 'right';
    tokenId: string;
};

const createActiveStep = (count: number): ActiveStep => ({
    id: `step-${count}`,
    left: null,
    leftTokenId: null,
    operator: null,
    right: null,
    rightTokenId: null,
});

const parseActiveStep = (raw: string | null, count: number): ActiveStep => {
    const fallback = createActiveStep(count);
    if (!raw) return fallback;

    try {
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== 'object') return fallback;

        const candidate = parsed as Partial<{
            id: unknown;
            left: unknown;
            leftTokenId: unknown;
            operator: unknown;
            right: unknown;
            rightTokenId: unknown;
        }>;

        return {
            id:
                typeof candidate.id === 'string' && candidate.id.length > 0
                    ? candidate.id
                    : fallback.id,
            left: parsePositiveInt(candidate.left),
            leftTokenId: typeof candidate.leftTokenId === 'string' ? candidate.leftTokenId : null,
            operator: parseOperator(candidate.operator),
            right: parsePositiveInt(candidate.right),
            rightTokenId:
                typeof candidate.rightTokenId === 'string' ? candidate.rightTokenId : null,
        };
    } catch {
        return fallback;
    }
};

export class StepsListElement extends HTMLElement {
    static readonly observedAttributes = [
        'steps',
        'locked',
        'rollback-step-id',
        'active-step',
    ] as const;

    private steps: StepData[] = [];

    private activeStep: ActiveStep = createActiveStep(1);

    private rollbackStepId: string | null = null;

    private get isLocked(): boolean {
        return this.hasAttribute('locked');
    }

    connectedCallback(): void {
        this.hydrateFromAttributes();
        this.addEventListener('number-selected', this.onNumberSelected as EventListener);
        this.addEventListener('operator-selected', this.onOperatorSelected as EventListener);
        this.addEventListener('step-token-remove', this.onStepTokenRemove as EventListener);
        this.addEventListener('step-complete', this.onStepComplete as EventListener);
        this.addEventListener('click', this.onRemoveStepClick as EventListener);
        this.render();
    }

    disconnectedCallback(): void {
        this.removeEventListener('number-selected', this.onNumberSelected as EventListener);
        this.removeEventListener('operator-selected', this.onOperatorSelected as EventListener);
        this.removeEventListener('step-token-remove', this.onStepTokenRemove as EventListener);
        this.removeEventListener('step-complete', this.onStepComplete as EventListener);
        this.removeEventListener('click', this.onRemoveStepClick as EventListener);
    }

    attributeChangedCallback(): void {
        this.hydrateFromAttributes();
        this.render();
    }

    get history(): StepData[] {
        return [...this.steps];
    }

    private hydrateFromAttributes(): void {
        this.steps = parseSteps(this.getAttribute('steps'));
        this.activeStep = parseActiveStep(this.getAttribute('active-step'), this.steps.length + 1);
        this.rollbackStepId = this.getAttribute('rollback-step-id');
    }

    private onNumberSelected = (event: CustomEvent<NumberSelectedPayload>): void => {
        if (event.target !== this) return;
        if (this.isLocked) return;

        if (event.detail.id === this.activeStep.leftTokenId) {
            this.activeStep.left = null;
            this.activeStep.leftTokenId = null;
            this.activeStep.right = null;
            this.activeStep.rightTokenId = null;
            this.render();
            return;
        }

        if (event.detail.id === this.activeStep.rightTokenId) {
            this.activeStep.right = null;
            this.activeStep.rightTokenId = null;
            this.render();
            return;
        }

        if (this.activeStep.left === null) {
            this.activeStep.left = event.detail.value;
            this.activeStep.leftTokenId = event.detail.id;
            this.render();
            return;
        }

        if (this.activeStep.right === null) {
            this.activeStep.right = event.detail.value;
            this.activeStep.rightTokenId = event.detail.id;
            this.render();
        }
    };

    private onOperatorSelected = (event: CustomEvent<OperatorSelectedPayload>): void => {
        if (event.target !== this) return;
        if (this.isLocked) return;

        this.activeStep.operator = event.detail.operator;
        this.render();
    };

    private onStepTokenRemove = (event: CustomEvent<StepTokenRemovePayload>): void => {
        if (this.isLocked) return;

        const activeElement = this.querySelector('step-equation[data-role="active"]');
        if (!activeElement || !activeElement.contains(event.target as Node)) return;

        const { slot, tokenId } = event.detail;
        if (slot === 'left' && tokenId === this.activeStep.leftTokenId) {
            this.activeStep.left = null;
            this.activeStep.leftTokenId = null;
            this.activeStep.right = null;
            this.activeStep.rightTokenId = null;
            this.render();
            return;
        }

        if (slot === 'right' && tokenId === this.activeStep.rightTokenId) {
            this.activeStep.right = null;
            this.activeStep.rightTokenId = null;
            this.render();
        }
    };

    private onStepComplete = (event: CustomEvent<StepData>): void => {
        if (this.isLocked) return;

        const complete = event.detail;
        if (complete.id !== this.activeStep.id) return;

        this.steps = [...this.steps, complete];
        this.activeStep = createActiveStep(this.steps.length + 1);
        this.emitStepsChanged();
        this.render();
    };

    private onRemoveStepClick = (event: MouseEvent): void => {
        if (this.isLocked) return;

        const target = event.target as HTMLElement;
        const button = target.closest<HTMLButtonElement>('button[data-remove-step-id]');
        if (!button || !this.contains(button)) return;

        const stepId = button.dataset.removeStepId;
        if (!stepId) return;

        const removeIndex = this.steps.findIndex((step) => step.id === stepId);
        if (removeIndex < 0) return;

        this.steps = this.steps.slice(0, removeIndex);
        this.activeStep = createActiveStep(this.steps.length + 1);
        this.emitStepsChanged();
        this.render();
    };

    private emitStepsChanged(): void {
        const detail: StepsChangedPayload = { steps: [...this.steps] };
        this.dispatchEvent(
            new CustomEvent<StepsChangedPayload>('steps-changed', {
                bubbles: true,
                detail,
            })
        );
    }

    private render(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'steps-list';
        wrapper.setAttribute('role', 'list');
        wrapper.setAttribute('aria-label', 'Completed and active steps');

        for (const step of this.steps) {
            const row = document.createElement('div');
            row.className = 'step-row';
            row.setAttribute('role', 'listitem');
            if (this.rollbackStepId === step.id) {
                row.classList.add('rollback-suggested');
            }

            const completed = document.createElement('step-equation');
            completed.setAttribute('locked', '');
            completed.setAttribute('id', step.id);
            completed.setAttribute('left', String(step.left));
            completed.setAttribute('operator', step.operator);
            completed.setAttribute('right', String(step.right));

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.className = 'step-remove-button';
            removeButton.dataset.removeStepId = step.id;
            removeButton.setAttribute('aria-label', `Remove ${step.id}`);
            removeButton.title = 'Remove step';
            removeButton.textContent = '×';
            removeButton.disabled = this.isLocked;
            if (this.rollbackStepId === step.id) {
                removeButton.classList.add('rollback-suggested');
            }

            row.append(completed, removeButton);
            wrapper.append(row);
        }

        if (!this.isLocked) {
            const active = document.createElement('step-equation');
            active.dataset.role = 'active';
            active.setAttribute('id', this.activeStep.id);
            if (this.activeStep.left !== null) {
                active.setAttribute('left', String(this.activeStep.left));
            }
            if (this.activeStep.leftTokenId !== null) {
                active.setAttribute('left-token-id', this.activeStep.leftTokenId);
            }
            if (this.activeStep.operator !== null) {
                active.setAttribute('operator', this.activeStep.operator);
            }
            if (this.activeStep.right !== null) {
                active.setAttribute('right', String(this.activeStep.right));
            }
            if (this.activeStep.rightTokenId !== null) {
                active.setAttribute('right-token-id', this.activeStep.rightTokenId);
            }

            wrapper.append(active);
        }
        this.replaceChildren(wrapper);
    }
}

customElements.define('steps-list', StepsListElement);
