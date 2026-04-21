/**
 * @purpose Displays hints in a standalone panel.
 *
 * This component remains useful for isolated rendering/tests, but the main
 * game now computes and displays hints on demand directly from `numbers-game`.
 */

import { getHint, HintLevel, type Hint, type HintGameState } from '../lib/hint-engine.js';
import type { StepData } from '../types.js';

export class HintPanelElement extends HTMLElement {
    static readonly observedAttributes = ['numbers', 'target', 'steps', 'hint-level'] as const;

    connectedCallback(): void {
        this.render();
    }

    attributeChangedCallback(): void {
        this.render();
    }

    /**
     * Parse the numbers attribute (JSON-encoded array).
     */
    private get availableNumbers(): number[] {
        const raw = this.getAttribute('numbers');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map((value) =>
                    typeof value === 'number'
                        ? value
                        : typeof value === 'string'
                          ? Number.parseInt(value, 10)
                          : Number.NaN
                )
                .filter((value) => Number.isFinite(value) && Number.isInteger(value) && value >= 1);
        } catch {
            return [];
        }
    }

    /**
     * Parse the target value.
     */
    private get targetValue(): number {
        const raw = this.getAttribute('target');
        if (!raw) return 0;
        const parsed = Number.parseInt(raw, 10);
        return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 1 ? parsed : 0;
    }

    /**
     * Parse the completed steps (JSON-encoded array).
     */
    private get completedSteps(): StepData[] {
        const raw = this.getAttribute('steps');
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    /**
     * Get the current hint level.
     */
    private get hintLevel(): HintLevel {
        const raw = this.getAttribute('hint-level');
        const level = Object.values(HintLevel).find((l) => l === raw);
        return level ?? HintLevel.NextOperands;
    }

    /**
     * Generate the current hint based on game state.
     */
    private getCurrentHint(): Hint | null {
        const gameState: HintGameState = {
            availableNumbers: this.availableNumbers,
            completedSteps: this.completedSteps,
            target: this.targetValue,
        };

        return getHint(gameState, this.hintLevel);
    }

    /**
     * Format a hint into human-readable text.
     */
    private formatHint(hint: Hint | null): string {
        if (!hint) {
            return 'No hint available.';
        }

        switch (hint.level) {
            case HintLevel.NextOperands:
                return `Try using ${hint.leftValue} and ${hint.rightValue}`;

            case HintLevel.NextOperator:
                return `${hint.leftValue} ${hint.operator} ${hint.rightValue}`;

            case HintLevel.NextStep:
                return `${hint.step.left} ${hint.step.operator} ${hint.step.right} = ${hint.step.result}`;

            case HintLevel.FullSolution: {
                const steps = hint.steps
                    .map((s) => `${s.left} ${s.operator} ${s.right} = ${s.result}`)
                    .join(', then ');
                return `Full solution: ${steps}`;
            }

            default:
                return 'No hint available.';
        }
    }

    private render(): void {
        const wrapper = document.createElement('div');
        wrapper.className = 'hint-panel';

        const hint = this.getCurrentHint();
        const hintText = this.formatHint(hint);

        const display = document.createElement('p');
        display.className = 'hint-text';
        display.textContent = hintText;

        wrapper.append(display);

        this.replaceChildren(wrapper);
    }
}

customElements.define('hint-panel', HintPanelElement);
