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
 * - Hint calculation is on-demand from the `Hint` button; the button cycles through increasing detail
 *   and resets after any completed step.
 * - If hinting cannot progress from the current state and completed steps exist, the UI suggests removing
 *   the latest step and highlights it as rollback guidance.
 * - `New game` shows a temporary loading state while solvability validation runs.
 */

import './numbers.js';
import './operators.js';
import './steps.js';
import './target.js';
import { findSolution } from '../lib/solver.js';
import { getHint, HintLevel } from '../lib/hint-engine.js';
import { resolveDifficulty, serializeHash } from '../lib/url-state.js';
import type {
    GameDifficulty,
    GameNewPayload,
    GameWonPayload,
    NumberSelectedPayload,
    NumberToken,
    OperatorSelectedPayload,
    StepData,
    StepsChangedPayload,
} from '../types.js';

const EASY_MAX_STEPS = 3;
const NORMAL_MIN_STEPS = 4;
const ROUND_NUMBER_ATTEMPTS = 20;
const ROUND_TARGET_ATTEMPTS = 20;

type RoundGenerationMetrics = {
    difficulty: GameDifficulty;
    attemptedPairs: number;
    solvablePairs: number;
    elapsedMs: number;
    bestCandidateStepCount: number | null;
};

/** Difficulty acceptance bands are based on shortest solution length. */
export const isInDifficultyBand = (difficulty: GameDifficulty, stepCount: number): boolean => {
    if (difficulty === 'easy') {
        return stepCount <= EASY_MAX_STEPS; // easy < 4
    }
    return stepCount >= NORMAL_MIN_STEPS; // normal > 3
};

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
export const generateTarget = (_numbers?: number[]): number => {
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
    static readonly observedAttributes = ['target', 'numbers', 'difficulty'] as const;

    private target = 0;

    private baseNumbers: number[] = [];

    private difficulty: GameDifficulty = 'normal';

    private tokens: NumberToken[] = [];

    private steps: StepData[] = [];

    private locked = false;

    private nextTokenId = 1;

    private selectedTokenIds: string[] = [];

    private hintLevel: HintLevel = HintLevel.NextOperands;

    private currentHint: string = '';

    private rollbackHintStepId: string | null = null;

    private isGenerating = false;

    private generationTimeout: ReturnType<typeof setTimeout> | null = null;

    private readonly topWinBannerId = `numbers-game-win-${Math.random().toString(36).slice(2, 10)}`;

    private readonly difficultySelectorId = `difficulty-select-${Math.random().toString(36).slice(2, 10)}`;

    connectedCallback(): void {
        this.addEventListener('number-selected', this.onNumberSelected as EventListener);
        this.addEventListener('operator-selected', this.onOperatorSelected as EventListener);
        this.addEventListener('steps-changed', this.onStepsChanged as EventListener);
        this.addEventListener('step-token-remove', this.onStepTokenRemove as EventListener);
        this.addEventListener('click', this.onActionClick as EventListener);
        this.addEventListener('change', this.onControlChange as EventListener);
        this.addEventListener('keydown', this.onDirectionalGroupNavigation as EventListener);
        window.addEventListener('hashchange', this.onHashChange);
        this.initializeFromAttributes();
        this.render();
    }

    disconnectedCallback(): void {
        this.clearGenerationTimeout();
        this.clearTopWinBanner();
        this.removeEventListener('number-selected', this.onNumberSelected as EventListener);
        this.removeEventListener('operator-selected', this.onOperatorSelected as EventListener);
        this.removeEventListener('steps-changed', this.onStepsChanged as EventListener);
        this.removeEventListener('step-token-remove', this.onStepTokenRemove as EventListener);
        this.removeEventListener('click', this.onActionClick as EventListener);
        this.removeEventListener('change', this.onControlChange as EventListener);
        this.removeEventListener('keydown', this.onDirectionalGroupNavigation as EventListener);
        window.removeEventListener('hashchange', this.onHashChange);
    }

    attributeChangedCallback(name: string): void {
        if (name === 'difficulty') {
            // Difficulty attribute change: only update difficulty + re-render, do not re-roll round.
            const resolvedConfig = resolveDifficulty({
                attributeValue: this.getAttribute('difficulty'),
                hash: window.location.hash,
            });
            this.difficulty = resolvedConfig.difficulty;
            this.render();
            return;
        }

        this.initializeFromAttributes();
        this.render();
    }

    private initializeFromAttributes(): void {
        const resolvedConfig = resolveDifficulty({
            attributeValue: this.getAttribute('difficulty'),
            hash: window.location.hash,
        });
        const parsedTarget = parseTargetAttribute(this.getAttribute('target'));
        const parsedNumbers = parseNumbersAttribute(this.getAttribute('numbers'));

        this.difficulty = resolvedConfig.difficulty;
        this.target = parsedTarget ?? generateTarget();
        this.baseNumbers = parsedNumbers ?? generateNumbers();
        this.resetRoundState();
    }

    private onHashChange = (): void => {
        // Only defer to the attribute when it resolves to a valid difficulty.
        const resolved = resolveDifficulty({
            attributeValue: this.getAttribute('difficulty'),
            hash: window.location.hash,
        });
        if (resolved.source === 'attribute') return;

        if (resolved.difficulty === this.difficulty) return;
        this.difficulty = resolved.difficulty;
        this.render();
    };

    private setDifficulty = (difficulty: GameDifficulty): void => {
        if (this.difficulty === difficulty) return;
        this.difficulty = difficulty;

        // When the difficulty attribute is present and valid, it is authoritative —
        // do not write to the URL hash, just re-render to reflect the new value.
        const resolved = resolveDifficulty({
            attributeValue: this.getAttribute('difficulty'),
            hash: window.location.hash,
        });
        if (resolved.source === 'attribute') {
            this.render();
            return;
        }

        const nextHash = serializeHash({ difficulty });
        if (nextHash === window.location.hash) {
            this.render();
            return;
        }

        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
        window.history.replaceState(null, '', nextUrl);
        this.render();
    };

    private scoreEasySolution = (
        steps: Array<{ value: number }>
    ): { stepCount: number; maxIntermediate: number; sumIntermediate: number } => {
        if (steps.length === 0) {
            return { stepCount: 0, maxIntermediate: 0, sumIntermediate: 0 };
        }

        return {
            stepCount: steps.length,
            maxIntermediate: Math.max(...steps.map((step) => step.value)),
            sumIntermediate: steps.reduce((sum, step) => sum + step.value, 0),
        };
    };

    private isBetterEasyCandidate = (
        next: { stepCount: number; maxIntermediate: number; sumIntermediate: number },
        current: { stepCount: number; maxIntermediate: number; sumIntermediate: number } | null
    ): boolean => {
        if (!current) return true;
        if (next.stepCount !== current.stepCount) return next.stepCount < current.stepCount;
        if (next.maxIntermediate !== current.maxIntermediate) {
            return next.maxIntermediate < current.maxIntermediate;
        }
        return next.sumIntermediate < current.sumIntermediate;
    };

    private resetRoundState(): void {
        this.steps = [];
        this.locked = false;
        this.selectedTokenIds = [];
        this.tokens = toTokens(this.baseNumbers);
        this.nextTokenId = this.tokens.length + 1;
        this.hintLevel = HintLevel.NextOperands;
        this.currentHint = '';
        this.rollbackHintStepId = null;
    }

    private clearGenerationTimeout(): void {
        if (this.generationTimeout !== null) {
            clearTimeout(this.generationTimeout);
            this.generationTimeout = null;
        }
    }

    private ensureTopWinBanner(): HTMLParagraphElement | null {
        if (!document.body) return null;

        let banner = document.getElementById(this.topWinBannerId) as HTMLParagraphElement | null;
        if (!banner) {
            banner = document.createElement('p');
            banner.id = this.topWinBannerId;
            banner.className = 'game-top-status';
            document.body.prepend(banner);
        }

        banner.textContent = 'You won! Start a new game to play again.';
        return banner;
    }

    private clearTopWinBanner(): void {
        const banner = document.getElementById(this.topWinBannerId);
        if (banner) banner.remove();
    }

    private maybeScrollTopWinBannerIntoView(): void {
        const banner = document.getElementById(this.topWinBannerId);
        if (!banner) return;

        const rect = banner.getBoundingClientRect();
        const isOutOfView = rect.top < 0 || rect.bottom > window.innerHeight;
        if (!isOutOfView) return;

        if (typeof banner.scrollIntoView === 'function') {
            banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    private getTimingNow(): number {
        return typeof performance !== 'undefined' ? performance.now() : Date.now();
    }

    private logEasyBandExhausted(metrics: RoundGenerationMetrics): void {
        console.info('[numbers-game] Easy band retries exhausted; using best solvable candidate.', {
            difficulty: metrics.difficulty,
            easyBandMaxStepsExclusive: EASY_MAX_STEPS + 1,
            attemptedPairs: metrics.attemptedPairs,
            solvablePairs: metrics.solvablePairs,
            bestCandidateStepCount: metrics.bestCandidateStepCount,
            elapsedMs: metrics.elapsedMs,
        });
    }

    private logNormalBandExhausted(metrics: RoundGenerationMetrics): void {
        console.info(
            '[numbers-game] Normal band retries exhausted; using best solvable candidate.',
            {
                difficulty: metrics.difficulty,
                normalBandMinStepsExclusive: NORMAL_MIN_STEPS - 1,
                attemptedPairs: metrics.attemptedPairs,
                solvablePairs: metrics.solvablePairs,
                bestCandidateStepCount: metrics.bestCandidateStepCount,
                elapsedMs: metrics.elapsedMs,
            }
        );
    }

    private logHardFallbackUsed(metrics: RoundGenerationMetrics): void {
        console.warn(
            '[numbers-game] Round retries exhausted; using guaranteed-solvable fallback.',
            {
                difficulty: metrics.difficulty,
                attemptedPairs: metrics.attemptedPairs,
                solvablePairs: metrics.solvablePairs,
                elapsedMs: metrics.elapsedMs,
            }
        );
    }

    private generateSolvableRound(difficulty: GameDifficulty): {
        numbers: number[];
        target: number;
    } {
        const startedAt = this.getTimingNow();
        let attemptedPairs = 0;
        let solvablePairs = 0;
        let bestEasyCandidate: {
            numbers: number[];
            target: number;
            score: { stepCount: number; maxIntermediate: number; sumIntermediate: number };
        } | null = null;
        let bestNormalCandidate: {
            numbers: number[];
            target: number;
            stepCount: number;
        } | null = null;

        for (let numberAttempts = 0; numberAttempts < ROUND_NUMBER_ATTEMPTS; numberAttempts += 1) {
            const numbers = generateNumbers();

            for (
                let targetAttempts = 0;
                targetAttempts < ROUND_TARGET_ATTEMPTS;
                targetAttempts += 1
            ) {
                attemptedPairs += 1;
                const target = generateTarget();
                const solution = findSolution(numbers, target);
                if (!solution.found) {
                    continue;
                }
                solvablePairs += 1;
                const stepCount = solution.steps.length;

                if (isInDifficultyBand(difficulty, stepCount)) {
                    return { numbers, target };
                }

                if (difficulty === 'easy') {
                    const score = this.scoreEasySolution(solution.steps);
                    if (this.isBetterEasyCandidate(score, bestEasyCandidate?.score ?? null)) {
                        bestEasyCandidate = {
                            numbers: [...numbers],
                            target,
                            score,
                        };
                    }
                    continue;
                }

                if (!bestNormalCandidate || stepCount > bestNormalCandidate.stepCount) {
                    bestNormalCandidate = {
                        numbers: [...numbers],
                        target,
                        stepCount,
                    };
                }
            }
        }

        if (difficulty === 'easy' && bestEasyCandidate) {
            this.logEasyBandExhausted({
                difficulty,
                attemptedPairs,
                solvablePairs,
                bestCandidateStepCount: bestEasyCandidate.score.stepCount,
                elapsedMs: Math.round(this.getTimingNow() - startedAt),
            });
            return { numbers: bestEasyCandidate.numbers, target: bestEasyCandidate.target };
        }

        if (difficulty === 'normal' && bestNormalCandidate) {
            this.logNormalBandExhausted({
                difficulty,
                attemptedPairs,
                solvablePairs,
                bestCandidateStepCount: bestNormalCandidate.stepCount,
                elapsedMs: Math.round(this.getTimingNow() - startedAt),
            });
            return { numbers: bestNormalCandidate.numbers, target: bestNormalCandidate.target };
        }

        // Guaranteed-solvable fallback: target is the sum of two available numbers.
        const fallbackNumbers = generateNumbers();
        const fallbackTarget = fallbackNumbers[0] + fallbackNumbers[1];
        this.logHardFallbackUsed({
            difficulty,
            attemptedPairs,
            solvablePairs,
            bestCandidateStepCount: null,
            elapsedMs: Math.round(this.getTimingNow() - startedAt),
        });
        return { numbers: fallbackNumbers, target: fallbackTarget };
    }

    private onActionClick = (event: MouseEvent): void => {
        const target = event.target as HTMLElement;
        const actionButton = target.closest<HTMLButtonElement>('button[data-action]');
        if (!actionButton || !this.contains(actionButton)) return;

        const action = actionButton.dataset.action;
        if (this.isGenerating && action !== 'new') {
            return;
        }

        if (action === 'reset') {
            this.resetRoundState();
            this.dispatchEvent(new CustomEvent('game-reset', { bubbles: true, detail: {} }));
            this.render();
            return;
        }

        if (action === 'hint') {
            // Calculate hint on demand
            const availableNumbers = this.tokens.filter((t) => !t.used).map((t) => t.value);
            if (availableNumbers.length < 2) {
                this.setNoHintAvailableState();
                this.render();
                return;
            }

            const gameState = {
                availableNumbers,
                completedSteps: this.steps,
                target: this.target,
            };
            const hint = getHint(gameState, this.hintLevel);

            // Format hint as text
            if (hint) {
                this.rollbackHintStepId = null;
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

                // Cycle to next hint level for next press.
                const levels = Object.values(HintLevel);
                const currentIndex = levels.indexOf(this.hintLevel);
                this.hintLevel = levels[(currentIndex + 1) % levels.length];
            } else {
                this.setNoHintAvailableState();
            }

            this.render();
            return;
        }

        if (action === 'new') {
            if (this.isGenerating) return;

            this.isGenerating = true;
            this.render(); // Show loading state

            // Use setTimeout to allow UI to update before heavy computation
            this.clearGenerationTimeout();
            this.generationTimeout = setTimeout(() => {
                this.generationTimeout = null;
                if (!this.isConnected) return;

                const nextRound = this.generateSolvableRound(this.difficulty);
                this.baseNumbers = nextRound.numbers;
                this.target = nextRound.target;
                this.resetRoundState();
                this.isGenerating = false;
                const detail: GameNewPayload = {
                    target: this.target,
                    numbers: [...this.baseNumbers],
                };
                this.dispatchEvent(
                    new CustomEvent<GameNewPayload>('game-new', { bubbles: true, detail })
                );
                this.render();
            }, 10);
            return;
        }
    };

    private setNoHintAvailableState(): void {
        if (this.steps.length > 0) {
            const latestStep = this.steps[this.steps.length - 1];
            this.rollbackHintStepId = latestStep.id;
            this.currentHint = 'No hint available. Try removing the latest step.';
        } else {
            this.rollbackHintStepId = null;
            this.currentHint = 'No hint available.';
        }

        this.hintLevel = HintLevel.NextOperands;
    }

    private onControlChange = (event: Event): void => {
        if (this.isGenerating) return;

        const target = event.target;
        if (!(target instanceof HTMLSelectElement)) return;
        if (target.dataset.action !== 'difficulty') return;
        const nextDifficulty = target.value;
        if (nextDifficulty !== 'easy' && nextDifficulty !== 'normal') return;
        this.setDifficulty(nextDifficulty);
    };

    private onNumberSelected = (event: CustomEvent<NumberSelectedPayload>): void => {
        if (this.locked || this.isGenerating) return;

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

    private onOperatorSelected = (event: CustomEvent<OperatorSelectedPayload>): void => {
        if (this.locked || this.isGenerating) return;

        const operators = this.querySelector('operator-buttons');
        if (!operators || !operators.contains(event.target as Node)) return;

        const stepsList = this.querySelector('steps-list');
        if (!stepsList) return;

        stepsList.dispatchEvent(
            new CustomEvent<OperatorSelectedPayload>('operator-selected', {
                bubbles: true,
                detail: event.detail,
            })
        );
    };

    private onStepsChanged = (event: CustomEvent<StepsChangedPayload>): void => {
        if (this.locked || this.isGenerating) return;

        const stepsList = this.querySelector('steps-list');
        if (event.target !== stepsList) return;

        const incoming = event.detail.steps;
        this.steps = [...incoming];
        this.selectedTokenIds = [];
        this.hintLevel = HintLevel.NextOperands; // Reset hint level on step completion
        this.currentHint = ''; // Clear any previous hint
        this.rollbackHintStepId = null;

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
        const becameLocked = Boolean(latest && latest.value === this.target);
        this.locked = becameLocked;
        if (this.locked && latest) {
            const detail: GameWonPayload = { target: this.target, steps: [...this.steps] };
            this.dispatchEvent(
                new CustomEvent<GameWonPayload>('game-won', { bubbles: true, detail })
            );
        }

        this.render();

        if (becameLocked) {
            this.maybeScrollTopWinBannerIntoView();
        }
    };

    private onStepTokenRemove = (event: CustomEvent<StepTokenRemovePayload>): void => {
        if (this.isGenerating) return;

        const stepsList = this.querySelector('steps-list');
        if (!stepsList || !stepsList.contains(event.target as Node)) return;

        this.selectedTokenIds = this.selectedTokenIds.filter((id) => id !== event.detail.tokenId);
    };

    private getFocusableGroupButtons(): {
        numbers: HTMLButtonElement[];
        operators: HTMLButtonElement[];
        controls: Array<HTMLButtonElement | HTMLSelectElement>;
    } {
        const numbers = Array.from(
            this.querySelectorAll<HTMLButtonElement>('numbers-pool button:not(:disabled)')
        );
        const operators = Array.from(
            this.querySelectorAll<HTMLButtonElement>('operator-buttons button:not(:disabled)')
        );
        const controls = Array.from(
            this.querySelectorAll<HTMLButtonElement | HTMLSelectElement>(
                '.game-controls button:not(:disabled), .game-controls select:not(:disabled)'
            )
        );

        return { numbers, operators, controls };
    }

    private onDirectionalGroupNavigation = (event: KeyboardEvent): void => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;

        const target = event.target;
        if (!(target instanceof HTMLElement)) return;
        if (
            target instanceof HTMLSelectElement ||
            target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement
        ) {
            return;
        }

        const { numbers, operators, controls } = this.getFocusableGroupButtons();
        const sourceGroups = [numbers, operators, controls].filter((group) => group.length > 0);
        if (sourceGroups.length < 2) return;

        const sourceGroupIndex = sourceGroups.findIndex((group) =>
            group.some((element) => element === target)
        );
        if (sourceGroupIndex < 0) return;

        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const destinationGroup = sourceGroups[sourceGroupIndex + direction];
        if (!destinationGroup || destinationGroup.length === 0) return;

        const sourceGroup = sourceGroups[sourceGroupIndex];
        const sourceIndex = sourceGroup.findIndex((element) => element === target);
        const nextIndex = Math.min(sourceIndex, destinationGroup.length - 1);

        event.preventDefault();
        destinationGroup[nextIndex].focus();
    };

    private render(): void {
        if (this.locked) {
            this.ensureTopWinBanner();
        } else {
            this.clearTopWinBanner();
        }

        const wrapper = document.createElement('section');
        wrapper.className = 'game-board';
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', 'Numbers game board');
        const interactionLocked = this.locked || this.isGenerating;

        const target = document.createElement('target-number');
        target.setAttribute('value', String(this.target));

        const difficultyControls = document.createElement('div');
        difficultyControls.className = 'difficulty-controls';

        const difficultyLabel = document.createElement('label');
        difficultyLabel.setAttribute('for', this.difficultySelectorId);
        difficultyLabel.textContent = 'Difficulty';

        const difficultySelect = document.createElement('select');
        difficultySelect.id = this.difficultySelectorId;
        difficultySelect.dataset.action = 'difficulty';
        difficultySelect.setAttribute('aria-label', 'Select difficulty');

        const normalOption = document.createElement('option');
        normalOption.value = 'normal';
        normalOption.textContent = 'Normal';

        const easyOption = document.createElement('option');
        easyOption.value = 'easy';
        easyOption.textContent = 'Easy';

        difficultySelect.append(normalOption, easyOption);
        difficultySelect.value = this.difficulty;
        difficultyControls.append(difficultyLabel, difficultySelect);

        const pool = document.createElement('numbers-pool');
        const visibleTokens = this.locked
            ? this.tokens.map((token) => ({ ...token, used: true }))
            : this.tokens;
        pool.setAttribute('tokens', JSON.stringify(visibleTokens));
        if (interactionLocked) {
            pool.setAttribute('locked', '');
        }

        // Create operators section
        const operatorsSection = document.createElement('operator-buttons');
        if (interactionLocked) {
            operatorsSection.setAttribute('locked', '');
        }

        const steps = document.createElement('steps-list');
        steps.setAttribute('steps', JSON.stringify(this.steps));
        if (this.rollbackHintStepId) {
            steps.setAttribute('rollback-step-id', this.rollbackHintStepId);
        }
        if (interactionLocked) {
            steps.setAttribute('locked', '');
        }

        const controls = document.createElement('div');
        controls.className = 'game-controls';
        controls.setAttribute('role', 'group');
        controls.setAttribute('aria-label', 'Gameplay controls');

        const resetButton = document.createElement('button');
        resetButton.type = 'button';
        resetButton.dataset.action = 'reset';
        resetButton.textContent = 'Reset board';
        resetButton.setAttribute('aria-label', 'Reset board');
        resetButton.disabled = this.isGenerating;

        const hintButton = document.createElement('button');
        hintButton.type = 'button';
        hintButton.dataset.action = 'hint';
        hintButton.textContent = 'Hint';
        hintButton.setAttribute('aria-label', 'Show hint');
        hintButton.disabled = interactionLocked;

        const newGameButton = document.createElement('button');
        newGameButton.type = 'button';
        newGameButton.dataset.action = 'new';
        newGameButton.textContent = 'New game';
        newGameButton.setAttribute('aria-label', 'Start new game');
        newGameButton.disabled = this.isGenerating;

        difficultySelect.disabled = this.isGenerating;

        controls.append(resetButton, hintButton, newGameButton, difficultyControls);

        wrapper.append(target, pool, operatorsSection, steps, controls);

        if (this.isGenerating) {
            const loadingMessage = document.createElement('p');
            loadingMessage.className = 'loading-message';
            loadingMessage.textContent = 'Generating new game...';
            loadingMessage.setAttribute('role', 'status');
            loadingMessage.setAttribute('aria-live', 'polite');
            wrapper.insertBefore(loadingMessage, controls);
        }

        // Display current hint if available
        if (this.currentHint) {
            const hintDisplay = document.createElement('p');
            hintDisplay.className = 'hint-display';
            hintDisplay.textContent = this.currentHint;
            hintDisplay.setAttribute('role', 'status');
            hintDisplay.setAttribute('aria-live', 'polite');
            hintDisplay.setAttribute('aria-atomic', 'true');
            wrapper.insertBefore(hintDisplay, steps);
        }

        this.replaceChildren(wrapper);
    }
}

customElements.define('numbers-game', NumbersGameElement);
