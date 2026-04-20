/**
 * @purpose Represents one arithmetic operation in the player's solution path.
 *
 * @inputs
 * - `id`       — unique identifier for this step.
 * - `left`     — the left-hand operand; a whole positive integer (≥ 1).
 * - `operator` — one of `'+'`, `'-'`, `'×'`, `'÷'`.
 * - `right`    — the right-hand operand; a whole positive integer (≥ 1).
 *
 * @fires `step-complete`
 *   Dispatched when all three of `left`, `operator`, and `right` are set and the result is valid.
 *   Payload: `{ id: string, left: number, operator: string, right: number, value: number }`
 *   Bubbles: yes.
 *
 * @fires `step-cleared`
 *   Dispatched when a step's inputs are cleared/reset before completion.
 *   Payload: `{ id: string }`
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
 * - A step is complete only when `left`, `operator`, and `right` are all present.
 * - Both operands are whole positive integers (≥ 1).
 * - `÷` is only valid when `left % right === 0`.
 * - `-` is only valid when `left > right` (so `value ≥ 1`).
 * - The computed `value` is always a whole positive integer (≥ 1) when the step is valid.
 * - The `value` is not provisional — it only exists once the step is complete and valid.
 */
