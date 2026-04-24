/**
 * @purpose Shared type definitions used across all game components.
 */

/**
 * The four arithmetic operators available in the game.
 * Display symbols are used throughout (not JS operator characters) to keep
 * rendering decoupled from evaluation logic.
 */
export type Operator = '+' | '-' | '×' | '÷';

/** Supported round difficulty modes. */
export type GameDifficulty = 'normal' | 'easy';

/** Game play mode — random generation or a deterministic daily puzzle. */
export type GameMode = 'random' | 'daily';

/** Source used to resolve the active round configuration. */
export type RoundConfigSource = 'default' | 'hash' | 'attribute';

/** Resolved round config used by the game component. */
export interface ResolvedRoundConfig {
    difficulty: GameDifficulty;
    source: RoundConfigSource;
}

/** URL-backed game state (currently difficulty + mode). */
export interface UrlGameState {
    difficulty: GameDifficulty;
    mode: GameMode;
}

/**
 * A single number token in the game's token pool.
 *
 * Tokens are distinguished by `id`, not `value`, so duplicate numeric values
 * (e.g. two tokens both holding `1`) remain individually trackable.
 *
 * @property id    - Unique identifier for this token within the current round.
 * @property value - The whole positive integer (≥ 1) this token represents.
 * @property used  - True when this token has been consumed as a step operand.
 *                   This state is permanent within a round and resets only on
 *                   game reset or new game.
 */
export interface NumberToken {
    id: string;
    value: number;
    used: boolean;
}

/**
 * The data record produced by a completed `Step`.
 *
 * Once a step is complete its `value` is added to the token pool as a new
 * single-use `NumberToken`, making it available to subsequent steps.
 *
 * @property id       - Unique identifier for this step.
 * @property left     - Left-hand operand (whole positive integer ≥ 1).
 * @property operator - The arithmetic operator applied.
 * @property right    - Right-hand operand (whole positive integer ≥ 1).
 * @property value    - Result of the expression; always a whole positive integer (≥ 1).
 *
 * Note: invalid complete expressions are displayed as `Error` in the active UI step but are never
 * represented as `StepData`; only valid completed steps enter history.
 */
export interface StepData {
    id: string;
    left: number;
    operator: Operator;
    right: number;
    value: number;
}

/**
 * The payload carried by a `number-selected` custom event.
 */
export interface NumberSelectedPayload {
    id: string;
    value: number;
}

/**
 * The payload carried by an `operator-selected` custom event.
 */
export interface OperatorSelectedPayload {
    operator: Operator;
}

/**
 * The payload carried by a `step-complete` custom event.
 * Identical in shape to `StepData` — the completed step's full record.
 */
export type StepCompletePayload = StepData;

/**
 * The payload carried by a `step-cleared` custom event.
 */
export interface StepClearedPayload {
    id: string;
}

/**
 * The payload carried by a `steps-changed` custom event.
 */
export interface StepsChangedPayload {
    steps: StepData[];
}

/**
 * The payload carried by a `game-won` custom event.
 */
export interface GameWonPayload {
    target: number;
    steps: StepData[];
}

/**
 * The payload carried by a `game-new` custom event.
 */
export interface GameNewPayload {
    target: number;
    numbers: number[];
}
