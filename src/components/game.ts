/**
 * @purpose Coordinates the full game flow and child components.
 *
 * @inputs
 * - Optional `target` attribute — whole positive integer (1–999); generated if omitted.
 * - Optional `numbers` attribute — six comma-separated whole positive integers; generated if omitted.
 *
 * @fires `game-won`
 *   Dispatched when a `Step` result equals the target.
 *   Payload: `GameWonPayload` — `{ target: number, steps: StepData[] }`
 *
 * @fires `game-reset`
 *   Dispatched when the board is reset (steps cleared, numbers and target preserved).
 *   Payload: `{}`
 *
 * @fires `game-new`
 *   Dispatched when a new game starts with fresh numbers and target.
 *   Payload: `GameNewPayload` — `{ target: number, numbers: number[] }`
 *
 * @invariants - Round setup
 * - A round has exactly one target and six starting number tokens.
 * - Reset clears all steps but preserves the current round's numbers and target.
 * - New game replaces both the target and numbers with freshly generated values.
 * - After a win, all gameplay actions are locked until a new game is started.
 *
 * @invariants - Hard game rules
 * - All operands, intermediate results, and the target are strictly positive integers (≥ 1).
 * - Division is only permitted when it produces an exact integer result (no remainders).
 * - Subtraction is only permitted when the result is ≥ 1 (zero and negative results are invalid).
 * - Each number token may be used at most once per game; tokens are distinguished by identity, not value.
 * - A completed step's `value` becomes a new single-use token; the two operand tokens it consumed are
 *   permanently marked as used. Token chaining across steps is fundamental to the game:
 *   e.g. `5 × 50 = 250`, then `250 − 75 = 175` — the result of the first step fuels the second.
 * - Step inputs may be provided as `left/right/operator`, `operator/left/right`, or
 *   `left/operator/right`; evaluation occurs once all three are present.
 * - If a complete expression is invalid (`-` would produce `<= 0`, or `÷` would be non-integer),
 *   it renders as `Error` and does not complete or create a result token.
 * - There is no limit on the number of steps; the player may chain as many as available tokens allow.
 *   For example, all six numbers could be combined one at a time using only `+` or `×`.
 * - Operators are never consumed; any operator may be used any number of times across any number of steps.
 * - Not all six starting numbers are required to be used.
 * - The game is won the moment any step's result equals the target; no further steps may be taken.
 * - The supported operators are addition (+), subtraction (−), multiplication (×), and division (÷).
 */

import './numbers.js';
import './steps.js';
import './target.js';
import { validateSolvability } from '../lib/validator.js';
import { getHint, HintLevel } from '../lib/hint-engine.js';
import type {
    GameNewPayload,
    GameWonPayload,
    NumberSelectedPayload,
    NumberToken,
    StepData,
    StepsChangedPayload,
} from '../types.js';

type StepTokenRemovePayload = {
    slot: 'left' | 'right';
    tokenId: string;
};

/** Generates six random numbers by drawing without replacement from the configured pool. */
export const generateNumbers = (): number[] => {
    const pool = [25, 50, 75, 100, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const remaining = [...pool];
    const picks: number[] = [];

    for (let i = 0; i < 6; i += 1) {
        const index = Math.floor(Math.random() * remaining.length);
        const [picked] = remaining.splice(index, 1);
        picks.push(picked);
    }

    return picks;
};

/** Generates an inclusive integer target in the range 1..999. */
export const generateTarget = (numbers?: number[]): number => {
    return Math.floor(Math.random() * 999) + 1;
};

const parseNumbersAttribute = (raw: string | null): number[] | null => {
    if (!raw) return null;
    const parsed = raw
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isInteger(value) && value >= 1);
    return parsed.length === 6 ? parsed : null;
};

const parseTargetAttribute = (raw: string | null): number | null => {
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 1 && parsed <= 999 ? parsed : null;
};

const createToken = (id: string, value: number): NumberToken => ({
    id,
    value,
    used: false,
});

const toTokens = (values: number[]): NumberToken[] =>
    values.map((value, index) => createToken(`n${index + 1}`, value));

const consumeByValue = (tokens: NumberToken[], value: number): void => {
    const match = tokens.find((token) => !token.used && token.value === value);
    if (match) {
        match.used = true;
    }
};

export class NumbersGameElement extends HTMLElement {
    static readonly observedAttributes = ['target', 'numbers'] as const;

    private target = 0;

    private baseNumbers: number[] = [];

    private tokens: NumberToken[] = [];

    private steps: StepData[] = [];

    private locked = false;

    private nextTokenId = 1;

    private selectedTokenIds: string[] = [];

    private hintLevel: HintLevel = HintLevel.NextOperands;

    private currentHint: string = '';

    private isGenerating = false;

    connectedCallback(): void {
        this.addEventListener('number-selected', this.onNumberSelected as EventListener);
        this.addEventListener('steps-changed', this.onStepsChanged as EventListener);
        this.addEventListener('step-token-remove', this.onStepTokenRemove as EventListener);
        this.addEventListener('click', this.onActionClick as EventListener);
        this.initializeFromAttributes();
        this.render();
    }

    disconnectedCallback(): void {
        this.removeEventListener('number-selected', this.onNumberSelected as EventListener);
        this.removeEventListener('steps-changed', this.onStepsChanged as EventListener);
        this.removeEventListener('step-token-remove', this.onStepTokenRemove as EventListener);
        this.removeEventListener('click', this.onActionClick as EventListener);
    }

    attributeChangedCallback(): void {
        this.initializeFromAttributes();
        this.render();
    }

    private initializeFromAttributes(): void {
        const parsedTarget = parseTargetAttribute(this.getAttribute('target'));
        const parsedNumbers = parseNumbersAttribute(this.getAttribute('numbers'));

        this.target = parsedTarget ?? generateTarget();
        this.baseNumbers = parsedNumbers ?? generateNumbers();
        this.resetRoundState();
    }

    private resetRoundState(): void {
        this.steps = [];
        this.locked = false;
        this.selectedTokenIds = [];
        this.tokens = toTokens(this.baseNumbers);
        this.nextTokenId = this.tokens.length + 1;
        this.hintLevel = HintLevel.NextOperands;
        this.currentHint = '';
    }

    private onActionClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const actionButton = target.closest<HTMLButtonElement>('button[data-action]');
        if (!actionButton || !this.contains(actionButton)) return;

        const action = actionButton.dataset.action;
        if (action === 'reset') {
            this.resetRoundState();
            this.dispatchEvent(new CustomEvent('game-reset', { bubbles: true, detail: {} }));
            this.render();
            return;
        }

        if (action === 'hint') {
            // Calculate hint on demand
            const availableNumbers = this.tokens.filter((t) => !t.used).map((t) => t.value);
            if (availableNumbers.length >= 2) {
                const gameState = {
                    availableNumbers,
                    completedSteps: this.steps,
                    target: this.target,
                };
                const hint = getHint(gameState, this.hintLevel);
                
                // Format hint as text
                if (hint) {
                    switch (hint.level) {
                        case HintLevel.NextOperands:
                            this.currentHint = `Try using ${hint.leftValue} and ${hint.rightValue}`;
                            break;
                        case HintLevel.NextOperator:
                            this.currentHint = `${hint.leftValue} ${hint.operator} ${hint.rightValue}`;
                            break;
                        case HintLevel.NextStep:
                            this.currentHint = `${hint.step.left} ${hint.step.operator} ${hint.step.right} = ${hint.step.result}`;
                            break;
                        case HintLevel.FullSolution:
                            this.currentHint = `Full solution: ${hint.steps
                                .map((s) => `${s.left} ${s.operator} ${s.right} = ${s.result}`)
                                .join(', then ')}`;
                            break;
                    }
                } else {
                    this.currentHint = 'No hint available.';
                }
                
                // Cycle to next hint level for next press
                const levels = Object.values(HintLevel);
                const currentIndex = levels.indexOf(this.hintLevel);
                this.hintLevel = levels[(currentIndex + 1) % levels.length];
            }
            this.render();
            return;
        }

        if (action === 'new') {
            this.isGenerating = true;
            this.render(); // Show loading state
            
            // Use setTimeout to allow UI to update before heavy computation
            setTimeout(() => {
                this.baseNumbers = generateNumbers();
                // Generate a target that's actually solvable (with 20 attempts)
                let target = generateTarget();
                for (let attempts = 0; attempts < 20; attempts += 1) {
                    if (validateSolvability(this.baseNumbers, target)) {
                        break;
                    }
                    target = generateTarget();
                }
                this.target = target;
                this.resetRoundState();
                this.isGenerating = false;
                const detail: GameNewPayload = { target: this.target, numbers: [...this.baseNumbers] };
                this.dispatchEvent(
                    new CustomEvent<GameNewPayload>('game-new', { bubbles: true, detail })
                );
                this.render();
            }, 10);
            return;
        }
    };

    private onNumberSelected = (event: CustomEvent<NumberSelectedPayload>): void => {
        if (this.locked) return;

        const pool = this.querySelector('numbers-pool');
        if (!pool || !pool.contains(event.target as Node)) return;

        const existingIndex = this.selectedTokenIds.indexOf(event.detail.id);
        if (existingIndex >= 0) {
            this.selectedTokenIds.splice(existingIndex, 1);
        } else if (this.selectedTokenIds.length < 2) {
            this.selectedTokenIds.push(event.detail.id);
        }

        const stepsList = this.querySelector('steps-list');
        if (!stepsList) return;

        stepsList.dispatchEvent(
            new CustomEvent<NumberSelectedPayload>('number-selected', {
                bubbles: true,
                detail: event.detail,
            })
        );
    };

    private onStepsChanged = (event: CustomEvent<StepsChangedPayload>): void => {
        if (this.locked) return;

        const stepsList = this.querySelector('steps-list');
        if (event.target !== stepsList) return;

        const incoming = event.detail.steps;
        this.steps = [...incoming];
        this.selectedTokenIds = [];
        this.hintLevel = HintLevel.NextOperands; // Reset hint level on step completion
        this.currentHint = ''; // Clear any previous hint

        this.tokens = toTokens(this.baseNumbers);
        this.nextTokenId = this.tokens.length + 1;

        for (const step of this.steps) {
            consumeByValue(this.tokens, step.left);
            consumeByValue(this.tokens, step.right);
            this.tokens.push({
                id: `n${this.nextTokenId++}`,
                value: step.value,
                used: false,
            });
        }

        const latest = this.steps[this.steps.length - 1];
        this.locked = Boolean(latest && latest.value === this.target);
        if (this.locked && latest) {
            const detail: GameWonPayload = { target: this.target, steps: [...this.steps] };
            this.dispatchEvent(
                new CustomEvent<GameWonPayload>('game-won', { bubbles: true, detail })
            );
        }

        this.render();
    };

    private onStepTokenRemove = (event: CustomEvent<StepTokenRemovePayload>): void => {
        const stepsList = this.querySelector('steps-list');
        if (!stepsList || !stepsList.contains(event.target as Node)) return;

        this.selectedTokenIds = this.selectedTokenIds.filter((id) => id !== event.detail.tokenId);
    };

    private render(): void {
        const wrapper = document.createElement('section');
        wrapper.className = 'game-board';

        // Show loading state while generating new game
        if (this.isGenerating) {
            const heading = document.createElement('h2');
            heading.textContent = 'Loading...';
            
            const loadingMessage = document.createElement('p');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Generating new game...';
            
            wrapper.append(heading, loadingMessage);
            this.replaceChildren(wrapper);
            return;
        }

        const heading = document.createElement('h2');
        heading.textContent = 'Game';

        const target = document.createElement('target-number');
        target.setAttribute('value', String(this.target));

        const pool = document.createElement('numbers-pool');
        const visibleTokens = this.locked
            ? this.tokens.map((token) => ({ ...token, used: true }))
            : this.tokens;
        pool.setAttribute('tokens', JSON.stringify(visibleTokens));

        const steps = document.createElement('steps-list');
        steps.setAttribute('steps', JSON.stringify(this.steps));
        if (this.locked) {
            steps.setAttribute('locked', '');
        }

        const controls = document.createElement('div');
        controls.className = 'game-controls';

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.dataset.action = 'reset';
        resetButton.textContent = 'Reset board';

        const hintButton = document.createElement('button');
        hintButton.type = 'button';
        hintButton.dataset.action = 'hint';
        hintButton.textContent = 'Hint';
        hintButton.disabled = this.locked;

        const newGameButton = document.createElement('button');
        newGameButton.type = 'button';
        newGameButton.dataset.action = 'new';
        newGameButton.textContent = 'New game';

        controls.append(resetButton, hintButton, newGameButton);

        wrapper.append(heading, target, pool, steps, controls);

        // Display current hint if available
        if (this.currentHint) {
            const hintDisplay = document.createElement('p');
            hintDisplay.className = 'hint-display';
            hintDisplay.textContent = this.currentHint;
            wrapper.append(hintDisplay);
        }

        if (this.locked) {
            const status = document.createElement('p');
            status.className = 'game-status';
            status.textContent = 'You won! Start a new game to play again.';
            wrapper.append(status);
        }

        this.replaceChildren(wrapper);
    }
}

customElements.define('numbers-game', NumbersGameElement);
