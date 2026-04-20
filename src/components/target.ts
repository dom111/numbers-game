/**
 * @purpose Displays the non-interactive target number for the current round.
 * @inputs
 * - `value` — the target integer for the active game; a whole positive integer in the range 1–999.
 *
 * @outputs None; this component is display-only.
 *
 * @invariants
 * - Target value is immutable for the duration of a round; it only changes when a new game starts.
 * - Renders a `Number` component in a non-interactive (disabled) state.
 */
