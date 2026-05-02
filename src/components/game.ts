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
 * - Hint calculation is on-demand from the `Hint` button; the button cycles through operands → operator
 *   → full solution, and resets after any completed step.
 * - The first hint level is free; revealing the operator (or beyond) counts as one paid hint for the
 *   current in-progress step when tracking daily challenge stats.
 * - Each successful hint request starts a 30-second cooldown during which the hint button is disabled
 *   and shows a countdown.
 * - If hinting cannot progress from the current state and completed steps exist, the UI suggests removing
 *   the latest step and highlights it as rollback guidance.
 * - `New game` shows a temporary loading state while solvability validation runs.
 * - Changing the difficulty from the in-game selector immediately starts a new round in that mode.
 * - Winning adds a lightweight decorative celebration effect; motion is disabled for reduced-motion users.
 */

import './numbers.js';
import './operators.js';
import './steps.js';
import './target.js';
import { findSolution } from '../lib/solver.js';
import { getHint, HintLevel } from '../lib/hint-engine.js';
import { resolveDifficulty, serializeHash, parseHash } from '../lib/url-state.js';
import { isInDifficultyBand, EASY_MAX_STEPS, NORMAL_MIN_STEPS } from '../lib/difficulty.js';
import { generateDailyRound, getDailyDateKey } from '../lib/daily.js';
import {
    recordDailyPuzzleWin,
    getDailyPuzzleStats,
    clearDailyPuzzleStats,
} from '../lib/daily-stats.js';
import { drawSixFromStandardPool } from '../lib/number-pool.js';
import { getStarRating } from '../lib/rating.js';
import { buildDailyShareText, shareText } from '../lib/share.js';
import type {
    GameDifficulty,
    GameMode,
    GameNewPayload,
    GameWonPayload,
    Operator,
    NumberSelectedPayload,
    NumberToken,
    OperatorSelectedPayload,
    StepData,
    StepsChangedPayload,
} from '../types.js';

const ROUND_NUMBER_ATTEMPTS = 20;
const ROUND_TARGET_ATTEMPTS = 20;
const HINT_COOLDOWN_MS = 30_000;
const HINT_LEVEL_SEQUENCE = [
    HintLevel.NextOperands,
    HintLevel.NextOperator,
    HintLevel.FullSolution,
] as const;

// Re-export for backward compatibility with tests and external consumers.
export { isInDifficultyBand };

type RoundGenerationMetrics = {
    difficulty: GameDifficulty;
    attemptedPairs: number;
    solvablePairs: number;
    elapsedMs: number;
    bestCandidateStepCount: number | null;
};

type StepTokenRemovePayload = {
    slot: 'left' | 'right';
    tokenId: string;
};

type ActiveStepDraft = {
    id: string;
    left: number | null;
    leftTokenId: string | null;
    operator: Operator | null;
    right: number | null;
    rightTokenId: string | null;
};

/** Generates six random numbers by drawing without replacement from the configured pool. */
export const generateNumbers = (): number[] => {
    return drawSixFromStandardPool(() => Math.random());
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

const createActiveStepDraft = (count: number): ActiveStepDraft => ({
    id: `step-${count}`,
    left: null,
    leftTokenId: null,
    operator: null,
    right: null,
    rightTokenId: null,
});

const parsePositiveStepValue = (raw: string | null): number | null => {
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
};

const parseOperatorValue = (raw: string | null): Operator | null => {
    return raw === '+' || raw === '-' || raw === '×' || raw === '÷' ? raw : null;
};

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

    private mode: GameMode = 'random';

    private dailyDateKey: string = getDailyDateKey();

    /** In-memory cache: key = `dateKey:difficulty` → round. Bounded to avoid memory growth. */
    private dailyCache: Map<string, { numbers: number[]; target: number }> = new Map();

    private tokens: NumberToken[] = [];

    private steps: StepData[] = [];

    private locked = false;

    private nextTokenId = 1;

    private selectedTokenIds: string[] = [];

    private activeStepDraft: ActiveStepDraft = createActiveStepDraft(1);

    private hintLevel: HintLevel = HintLevel.NextOperands;

    private currentHint: string = '';

    private rollbackHintStepId: string | null = null;

    private isGenerating = false;

    private generationTimeout: ReturnType<typeof setTimeout> | null = null;

    private hintCooldownInterval: ReturnType<typeof setInterval> | null = null;

    private hintCooldownExpiresAt = 0;

    private hintCooldownRemainingSeconds = 0;

    private dailyHintCount = 0;

    private paidHintAppliedForCurrentProgress = false;

    private winShortestStepCount: number | null = null;

    private winStars: number | null = null;

    private shareStatus = '';

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
        this.clearHintCooldown();
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
        const hashState = parseHash(window.location.hash);
        const parsedTarget = parseTargetAttribute(this.getAttribute('target'));
        const parsedNumbers = parseNumbersAttribute(this.getAttribute('numbers'));

        this.difficulty = resolvedConfig.difficulty;
        this.mode = hashState.mode ?? 'random';

        if (this.mode === 'daily') {
            this.dailyDateKey = getDailyDateKey();
            // Keep initial render responsive: defer solver-backed daily generation.
            this.target = parsedTarget ?? (this.target >= 1 ? this.target : generateTarget());
            this.baseNumbers =
                parsedNumbers ??
                (this.baseNumbers.length === 6 ? this.baseNumbers : generateNumbers());
            this.resetRoundState();
            this.startNewGameGeneration();
            return;
        }

        this.target = parsedTarget ?? generateTarget();
        this.baseNumbers = parsedNumbers ?? generateNumbers();
        this.resetRoundState();
    }

    private getOrGenerateDailyRound(difficulty: GameDifficulty): {
        numbers: number[];
        target: number;
    } {
        const cacheKey = `${this.dailyDateKey}:${difficulty}`;
        if (this.dailyCache.has(cacheKey)) {
            return this.dailyCache.get(cacheKey)!;
        }
        const round = generateDailyRound(difficulty, this.dailyDateKey);
        // Bound cache to avoid unbounded growth across difficulty switches.
        if (this.dailyCache.size >= 10) {
            const firstKey = this.dailyCache.keys().next().value;
            if (firstKey !== undefined) this.dailyCache.delete(firstKey);
        }
        this.dailyCache.set(cacheKey, { numbers: round.numbers, target: round.target });
        return round;
    }

    private restorePreviousDailyCompletion(): void {
        const stats = getDailyPuzzleStats(this.dailyDateKey, this.difficulty);
        if (!stats?.completed || !stats.steps) return;

        if (!this.canRestorePreviousDailyCompletion(stats.steps)) {
            clearDailyPuzzleStats(this.dailyDateKey, this.difficulty);
            return;
        }

        // Restore the completed steps
        this.steps = [...stats.steps];
        this.locked = true;

        // Rebuild token pool to match the completed state
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

        this.dailyHintCount = stats.hintCount ?? 0;
        this.setWinPerformance(this.steps.length, stats.shortestStepCount, stats.stars);
    }

    private getShortestSolutionStepCount(): number | null {
        const solution = findSolution(this.baseNumbers, this.target);
        if (!solution.found || solution.steps.length < 1) {
            return null;
        }
        return solution.steps.length;
    }

    private setWinPerformance(
        playerSteps: number,
        persistedShortestStepCount?: number | null,
        persistedStars?: number | null
    ): void {
        const shortestStepCount =
            persistedShortestStepCount && persistedShortestStepCount >= 1
                ? persistedShortestStepCount
                : this.getShortestSolutionStepCount();

        if (!shortestStepCount || shortestStepCount < 1) {
            this.winShortestStepCount = null;
            this.winStars = null;
            return;
        }

        this.winShortestStepCount = shortestStepCount;
        this.winStars =
            persistedStars !== undefined && persistedStars !== null
                ? Math.max(0, Math.min(3, Math.floor(persistedStars)))
                : getStarRating(playerSteps, shortestStepCount);
    }

    private getDailyShareUrl(): string {
        const hash = serializeHash({ difficulty: this.difficulty, mode: 'daily' });
        return `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
    }

    private getDailySharePayload(): string | null {
        if (
            !this.locked ||
            this.mode !== 'daily' ||
            !this.winShortestStepCount ||
            this.winStars === null
        ) {
            return null;
        }

        return buildDailyShareText({
            dateKey: this.dailyDateKey,
            difficulty: this.difficulty,
            stars: this.winStars,
            shortestStepCount: this.winShortestStepCount,
            moveCount: this.steps.length,
            hintCount: this.dailyHintCount,
            url: this.getDailyShareUrl(),
        });
    }

    private handleShare = async (): Promise<void> => {
        const payload = this.getDailySharePayload();
        if (!payload) return;

        const outcome = await shareText(payload);
        if (outcome === 'shared') {
            this.shareStatus = 'Shared result.';
        } else if (outcome === 'copied') {
            this.shareStatus = 'Copied result to clipboard.';
        } else if (outcome === 'cancelled') {
            this.shareStatus = 'Share canceled.';
        } else {
            this.shareStatus = 'Share APIs unavailable. Copy the text below manually.';
        }
        this.render();
    };

    private getRestoredStepValue(step: StepData): number | null {
        switch (step.operator) {
            case '+':
                return step.left + step.right;
            case '-': {
                const result = step.left - step.right;
                return result >= 1 ? result : null;
            }
            case '×':
                return step.left * step.right;
            case '÷':
                return step.right !== 0 && step.left % step.right === 0
                    ? step.left / step.right
                    : null;
            default:
                return null;
        }
    }

    private consumeAvailableValue(values: number[], value: number): boolean {
        const index = values.indexOf(value);
        if (index < 0) return false;
        values.splice(index, 1);
        return true;
    }

    private canRestorePreviousDailyCompletion(steps: StepData[]): boolean {
        if (!Array.isArray(steps) || steps.length === 0) return false;

        const availableValues = [...this.baseNumbers];
        for (const step of steps) {
            if (
                !Number.isInteger(step.left) ||
                step.left < 1 ||
                !Number.isInteger(step.right) ||
                step.right < 1 ||
                !Number.isInteger(step.value) ||
                step.value < 1
            ) {
                return false;
            }

            const computedValue = this.getRestoredStepValue(step);
            if (computedValue === null || computedValue !== step.value) return false;

            if (!this.consumeAvailableValue(availableValues, step.left)) return false;
            if (!this.consumeAvailableValue(availableValues, step.right)) return false;

            availableValues.push(step.value);
        }

        return steps[steps.length - 1].value === this.target;
    }

    private onHashChange = (): void => {
        // Difficulty may be attribute-controlled, but hash mode changes should still apply.
        const resolved = resolveDifficulty({
            attributeValue: this.getAttribute('difficulty'),
            hash: window.location.hash,
        });

        const hashState = parseHash(window.location.hash);
        const newMode = hashState.mode ?? 'random';
        const nextDifficulty = resolved.difficulty;
        const difficultyChanged = nextDifficulty !== this.difficulty;
        const modeChanged = newMode !== this.mode;

        if (!difficultyChanged && !modeChanged) return;
        this.difficulty = nextDifficulty;
        this.mode = newMode;
        this.startNewGameGeneration();
    };

    private setDifficulty = (difficulty: GameDifficulty): boolean => {
        // When the difficulty attribute is present and valid, it is authoritative —
        // ignore selector attempts and re-render the authoritative value.
        const resolved = resolveDifficulty({
            attributeValue: this.getAttribute('difficulty'),
            hash: window.location.hash,
        });
        if (resolved.source === 'attribute') {
            this.difficulty = resolved.difficulty;
            this.render();
            return false;
        }

        if (this.difficulty === difficulty) return false;
        this.difficulty = difficulty;

        const nextHash = serializeHash({
            difficulty,
            mode: this.mode === 'daily' ? 'daily' : undefined,
        });
        if (nextHash === window.location.hash) {
            this.render();
            return true;
        }

        const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
        window.history.replaceState(null, '', nextUrl);
        this.render();
        return true;
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

    private resetRoundState(options?: {
        preserveHintCooldown?: boolean;
        preserveDailyHintCount?: boolean;
    }): void {
        this.steps = [];
        this.locked = false;
        this.selectedTokenIds = [];
        this.tokens = toTokens(this.baseNumbers);
        this.nextTokenId = this.tokens.length + 1;
        this.activeStepDraft = createActiveStepDraft(this.steps.length + 1);
        this.hintLevel = HintLevel.NextOperands;
        this.currentHint = '';
        this.rollbackHintStepId = null;
        this.paidHintAppliedForCurrentProgress = false;
        if (!options?.preserveHintCooldown) {
            this.clearHintCooldown();
        }
        if (!options?.preserveDailyHintCount) {
            this.dailyHintCount = 0;
        }
        this.winShortestStepCount = null;
        this.winStars = null;
        this.shareStatus = '';
    }

    private clearGenerationTimeout(): void {
        if (this.generationTimeout !== null) {
            clearTimeout(this.generationTimeout);
            this.generationTimeout = null;
        }
    }

    private clearHintCooldown(): void {
        if (this.hintCooldownInterval !== null) {
            clearInterval(this.hintCooldownInterval);
            this.hintCooldownInterval = null;
        }
        this.hintCooldownExpiresAt = 0;
        this.hintCooldownRemainingSeconds = 0;
    }

    private getHintCooldownSecondsRemaining(now = this.getTimingNow()): number {
        if (this.hintCooldownExpiresAt <= now) {
            return 0;
        }

        return Math.ceil((this.hintCooldownExpiresAt - now) / 1000);
    }

    private updateHintCooldown = (): void => {
        const nextRemaining = this.getHintCooldownSecondsRemaining();
        if (nextRemaining === this.hintCooldownRemainingSeconds) {
            return;
        }

        this.hintCooldownRemainingSeconds = nextRemaining;
        if (nextRemaining <= 0) {
            this.clearHintCooldown();
        }

        this.render();
    };

    private startHintCooldown(): void {
        this.hintCooldownExpiresAt = this.getTimingNow() + HINT_COOLDOWN_MS;
        this.hintCooldownRemainingSeconds = Math.ceil(HINT_COOLDOWN_MS / 1000);

        if (this.hintCooldownInterval !== null) {
            clearInterval(this.hintCooldownInterval);
        }

        this.hintCooldownInterval = setInterval(() => {
            if (!this.isConnected) {
                this.clearHintCooldown();
                return;
            }

            this.updateHintCooldown();
        }, 1000);
    }

    private getNextHintLevel(level: HintLevel): HintLevel {
        const currentIndex = HINT_LEVEL_SEQUENCE.indexOf(level);
        if (currentIndex < 0) {
            return HintLevel.NextOperands;
        }

        return HINT_LEVEL_SEQUENCE[(currentIndex + 1) % HINT_LEVEL_SEQUENCE.length];
    }

    private getHintButtonText(): string {
        return this.hintCooldownRemainingSeconds > 0
            ? `Hint (${this.hintCooldownRemainingSeconds}s)`
            : 'Hint';
    }

    private startNewGameGeneration(): void {
        if (this.isGenerating) return;

        this.isGenerating = true;
        this.locked = false; // Clear locked state before rendering loading message
        this.render();

        // Allow loading UI to paint before round generation runs.
        this.clearGenerationTimeout();
        this.generationTimeout = setTimeout(() => {
            this.generationTimeout = null;
            if (!this.isConnected) return;

            let nextRound: { numbers: number[]; target: number };
            if (this.mode === 'daily') {
                this.dailyDateKey = getDailyDateKey();
                nextRound = this.getOrGenerateDailyRound(this.difficulty);
            } else {
                nextRound = this.generateSolvableRound(this.difficulty);
            }
            this.baseNumbers = nextRound.numbers;
            this.target = nextRound.target;
            this.resetRoundState();

            // Check if this daily puzzle was previously completed
            if (this.mode === 'daily') {
                this.restorePreviousDailyCompletion();
            }

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
    }

    private syncSelectedTokenIdsFromActiveStep(): void {
        const activeStep = this.querySelector('steps-list step-equation[data-role="active"]');
        if (!activeStep) {
            this.selectedTokenIds = [];
            return;
        }

        const nextSelected: string[] = [];
        const leftId = activeStep.getAttribute('left-token-id');
        const rightId = activeStep.getAttribute('right-token-id');
        if (leftId) nextSelected.push(leftId);
        if (rightId) nextSelected.push(rightId);
        this.selectedTokenIds = nextSelected;
    }

    private syncActiveStepDraftFromDom(): void {
        const activeStep = this.querySelector('steps-list step-equation[data-role="active"]');
        if (!activeStep) {
            this.activeStepDraft = createActiveStepDraft(this.steps.length + 1);
            return;
        }

        this.activeStepDraft = {
            id: activeStep.getAttribute('id') ?? `step-${this.steps.length + 1}`,
            left: parsePositiveStepValue(activeStep.getAttribute('left')),
            leftTokenId: activeStep.getAttribute('left-token-id'),
            operator: parseOperatorValue(activeStep.getAttribute('operator')),
            right: parsePositiveStepValue(activeStep.getAttribute('right')),
            rightTokenId: activeStep.getAttribute('right-token-id'),
        };
    }

    private syncSelectedTokensToPool(): void {
        const pool = this.querySelector('numbers-pool');
        if (!pool) return;
        pool.setAttribute('selected-token-ids', JSON.stringify(this.selectedTokenIds));
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
            this.resetRoundState({
                preserveHintCooldown: true,
                preserveDailyHintCount: this.mode === 'daily',
            });
            this.dispatchEvent(new CustomEvent('game-reset', { bubbles: true, detail: {} }));
            this.render();
            return;
        }

        if (action === 'hint') {
            if (this.locked || this.hintCooldownRemainingSeconds > 0) {
                return;
            }

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
                    case HintLevel.FullSolution:
                        this.currentHint = `Full solution: ${hint.steps
                            .map((s) => `${s.left} ${s.operator} ${s.right} = ${s.result}`)
                            .join(', then ')}`;
                        break;
                }

                if (
                    this.mode === 'daily' &&
                    this.hintLevel === HintLevel.NextOperator &&
                    !this.paidHintAppliedForCurrentProgress
                ) {
                    this.dailyHintCount += 1;
                    this.paidHintAppliedForCurrentProgress = true;
                }

                this.startHintCooldown();
                this.hintLevel = this.getNextHintLevel(this.hintLevel);
            } else {
                this.setNoHintAvailableState();
            }

            this.render();
            return;
        }

        if (action === 'new') {
            // Clicking "New game" always starts a random game, exiting daily mode.
            if (this.mode === 'daily') {
                this.mode = 'random';
                const nextHash = serializeHash({ difficulty: this.difficulty });
                const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
                window.history.replaceState(null, '', nextUrl);
            }
            this.startNewGameGeneration();
            return;
        }

        if (action === 'daily') {
            if (this.mode === 'daily') return;
            this.mode = 'daily';
            this.dailyDateKey = getDailyDateKey();
            // Update URL hash to reflect daily mode.
            const nextHash = serializeHash({ difficulty: this.difficulty, mode: 'daily' });
            const nextUrl = `${window.location.pathname}${window.location.search}${nextHash}`;
            window.history.replaceState(null, '', nextUrl);
            this.startNewGameGeneration();
            return;
        }

        if (action === 'share') {
            void this.handleShare();
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
        if (nextDifficulty === this.difficulty) return;
        if (this.setDifficulty(nextDifficulty)) {
            this.startNewGameGeneration();
        }
    };

    private onNumberSelected = (event: CustomEvent<NumberSelectedPayload>): void => {
        if (this.locked || this.isGenerating) return;

        const pool = this.querySelector('numbers-pool');
        if (!pool || !pool.contains(event.target as Node)) return;

        const stepsList = this.querySelector('steps-list');
        if (!stepsList) return;

        stepsList.dispatchEvent(
            new CustomEvent<NumberSelectedPayload>('number-selected', {
                bubbles: true,
                detail: event.detail,
            })
        );

        // Derive selection from the active step so UI stays in sync with step-side token clearing rules.
        this.syncSelectedTokenIdsFromActiveStep();
        this.syncActiveStepDraftFromDom();
        this.syncSelectedTokensToPool();
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

        this.syncActiveStepDraftFromDom();
    };

    private onStepsChanged = (event: CustomEvent<StepsChangedPayload>): void => {
        if (this.locked || this.isGenerating) return;

        const stepsList = this.querySelector('steps-list');
        if (event.target !== stepsList) return;

        const incoming = event.detail.steps;
        this.steps = [...incoming];
        this.selectedTokenIds = [];
        this.activeStepDraft = createActiveStepDraft(this.steps.length + 1);
        this.hintLevel = HintLevel.NextOperands; // Reset hint level on step completion
        this.currentHint = ''; // Clear any previous hint
        this.rollbackHintStepId = null;
        this.paidHintAppliedForCurrentProgress = false;

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
            this.setWinPerformance(this.steps.length);

            // Record win for daily puzzles
            if (this.mode === 'daily') {
                recordDailyPuzzleWin(
                    this.dailyDateKey,
                    this.difficulty,
                    this.steps.length,
                    this.steps,
                    this.winShortestStepCount,
                    this.winStars,
                    this.dailyHintCount
                );
            }

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

    private onStepTokenRemove = (_event: CustomEvent<StepTokenRemovePayload>): void => {
        if (this.isGenerating) return;

        const stepsList = this.querySelector('steps-list');
        if (!stepsList) return;

        this.syncSelectedTokenIdsFromActiveStep();
        this.syncActiveStepDraftFromDom();
        this.syncSelectedTokensToPool();
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
        const isVerticalKey = event.key === 'ArrowDown' || event.key === 'ArrowUp';
        const isHorizontalKey = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
        const isHomeEnd = event.key === 'Home' || event.key === 'End';
        if (!isVerticalKey && !isHorizontalKey && !isHomeEnd) return;

        const target = event.target;
        if (!(target instanceof HTMLElement)) return;

        const sourceElement =
            target.closest('button, select, input, textarea') ??
            (target instanceof HTMLElement ? target : null);
        if (!(sourceElement instanceof HTMLElement)) return;

        const { numbers, operators, controls } = this.getFocusableGroupButtons();

        if (isHorizontalKey || isHomeEnd) {
            // Preserve native selector behavior; only drive control-row arrows from buttons.
            if (sourceElement instanceof HTMLSelectElement) return;

            const controlIndex = controls.findIndex((element) => element === sourceElement);
            if (controlIndex < 0 || controls.length < 2) return;

            event.preventDefault();
            if (event.key === 'Home') {
                controls[0].focus();
                return;
            }
            if (event.key === 'End') {
                controls[controls.length - 1].focus();
                return;
            }

            const delta = event.key === 'ArrowRight' ? 1 : -1;
            const nextIndex = (controlIndex + delta + controls.length) % controls.length;
            controls[nextIndex].focus();
            return;
        }

        // Keep ArrowUp/ArrowDown native behavior on form controls like the difficulty select.
        if (
            sourceElement instanceof HTMLSelectElement ||
            sourceElement instanceof HTMLInputElement ||
            sourceElement instanceof HTMLTextAreaElement
        ) {
            return;
        }

        const sourceGroups = [numbers, operators, controls].filter((group) => group.length > 0);
        if (sourceGroups.length < 2) return;

        const sourceGroupIndex = sourceGroups.findIndex((group) =>
            group.some((element) => element === sourceElement)
        );
        if (sourceGroupIndex < 0) return;

        const direction = event.key === 'ArrowDown' ? 1 : -1;
        const destinationGroup = sourceGroups[sourceGroupIndex + direction];
        if (!destinationGroup || destinationGroup.length === 0) return;

        const sourceGroup = sourceGroups[sourceGroupIndex];
        const sourceIndex = sourceGroup.findIndex((element) => element === sourceElement);
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
        if (this.locked) {
            wrapper.classList.add('is-won');
        }
        wrapper.setAttribute('role', 'region');
        wrapper.setAttribute('aria-label', 'Numbers game board');
        const interactionLocked = this.locked || this.isGenerating;
        const hintDisabled = interactionLocked || this.hintCooldownRemainingSeconds > 0;

        const targetSection = document.createElement('div');
        targetSection.className = 'target-section-with-badge';

        const target = document.createElement('target-number');
        target.setAttribute('value', String(this.target));
        if (this.locked) {
            target.setAttribute('celebrating', '');
        }

        targetSection.append(target);

        // Only show difficulty badge for Easy mode
        if (this.difficulty === 'easy') {
            const difficultyBadge = document.createElement('div');
            difficultyBadge.className = 'difficulty-badge';
            difficultyBadge.textContent = 'Easy';
            difficultyBadge.setAttribute('aria-label', 'Difficulty: Easy');
            targetSection.append(difficultyBadge);
        }

        // Show daily puzzle badge when in daily mode
        if (this.mode === 'daily') {
            const dailyBadge = document.createElement('div');
            dailyBadge.className = 'daily-badge';
            // Keep the label locale-independent so all players see the same canonical date key.
            const dateLabel = this.dailyDateKey;
            dailyBadge.textContent = `Daily — ${dateLabel}`;
            dailyBadge.setAttribute('aria-label', `Daily puzzle for ${dateLabel}`);
            targetSection.append(dailyBadge);
        }

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
        pool.setAttribute('selected-token-ids', JSON.stringify(this.selectedTokenIds));
        if (interactionLocked) {
            pool.setAttribute('locked', '');
        }

        // Create operators section
        const operatorsSection = document.createElement('operator-buttons');
        if (this.activeStepDraft.left !== null) {
            operatorsSection.setAttribute('left', String(this.activeStepDraft.left));
        }
        if (this.activeStepDraft.right !== null) {
            operatorsSection.setAttribute('right', String(this.activeStepDraft.right));
        }
        if (interactionLocked) {
            operatorsSection.setAttribute('locked', '');
        }

        const steps = document.createElement('steps-list');
        steps.setAttribute('steps', JSON.stringify(this.steps));
        steps.setAttribute('active-step', JSON.stringify(this.activeStepDraft));
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
        hintButton.textContent = this.getHintButtonText();
        hintButton.setAttribute(
            'aria-label',
            this.hintCooldownRemainingSeconds > 0
                ? `Show hint (available in ${this.hintCooldownRemainingSeconds} seconds)`
                : 'Show hint'
        );
        hintButton.disabled = hintDisabled;

        const newGameButton = document.createElement('button');
        newGameButton.type = 'button';
        newGameButton.dataset.action = 'new';
        newGameButton.textContent = 'New game';
        newGameButton.setAttribute('aria-label', 'Start new game');
        newGameButton.disabled = this.isGenerating;

        difficultySelect.disabled = this.isGenerating;

        const dailyButton = document.createElement('button');
        dailyButton.type = 'button';
        dailyButton.dataset.action = 'daily';
        dailyButton.textContent = 'Daily puzzle';
        dailyButton.setAttribute('aria-label', "Play today's daily puzzle");
        dailyButton.disabled = this.isGenerating || this.mode === 'daily';
        if (this.mode === 'daily') {
            dailyButton.setAttribute('aria-pressed', 'true');
        }

        controls.append(resetButton, hintButton, newGameButton, dailyButton, difficultyControls);

        wrapper.append(targetSection, pool, operatorsSection, steps, controls);

        if (this.locked && this.winShortestStepCount && this.winStars !== null) {
            const winSummary = document.createElement('div');
            winSummary.className = 'win-summary';

            const rating = document.createElement('p');
            rating.className = 'win-rating';

            // Create star rating display with separate styling for filled/empty stars
            const starsSpan = document.createElement('span');
            starsSpan.className = 'star-rating';
            starsSpan.setAttribute('aria-hidden', 'true');

            // Add filled stars
            for (let i = 0; i < this.winStars; i++) {
                const filledStar = document.createElement('span');
                filledStar.className = 'star-filled';
                filledStar.textContent = '⭐';
                starsSpan.append(filledStar);
            }

            // Add empty stars
            for (let i = 0; i < 3 - this.winStars; i++) {
                const emptyStar = document.createElement('span');
                emptyStar.className = 'star-empty';
                emptyStar.textContent = '⭐';
                starsSpan.append(emptyStar);
            }

            rating.append(
                'Rating: ',
                starsSpan,
                ` (${this.winStars}/3 stars) · Moves ${this.steps.length} vs best ${this.winShortestStepCount}`
            );
            winSummary.append(rating);

            if (this.mode === 'daily') {
                const hintSummary = document.createElement('p');
                hintSummary.className = 'daily-hint-summary';
                hintSummary.textContent = `Hints used: ${this.dailyHintCount}`;
                winSummary.append(hintSummary);

                const shareButton = document.createElement('button');
                shareButton.type = 'button';
                shareButton.dataset.action = 'share';
                shareButton.className = 'share-button';
                shareButton.textContent = 'Share result';
                shareButton.setAttribute('aria-label', 'Share daily result');
                shareButton.disabled = this.isGenerating;
                winSummary.append(shareButton);

                const sharePreview = document.createElement('pre');
                sharePreview.className = 'share-preview';
                sharePreview.textContent = this.getDailySharePayload() ?? '';
                winSummary.append(sharePreview);

                if (this.shareStatus) {
                    const shareStatus = document.createElement('p');
                    shareStatus.className = 'share-status';
                    shareStatus.textContent = this.shareStatus;
                    shareStatus.setAttribute('role', 'status');
                    shareStatus.setAttribute('aria-live', 'polite');
                    shareStatus.setAttribute('aria-atomic', 'true');
                    winSummary.append(shareStatus);
                }
            }

            wrapper.insertBefore(winSummary, controls);
        }

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
