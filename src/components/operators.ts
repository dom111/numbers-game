/**
 * @purpose Presents available arithmetic operators for the active `Step`.
 *
 * @inputs
 * - Current active `Step` operand state, used to determine which operators are valid.
 *
 * @fires `operator-selected`
 *   Dispatched when an operator button is clicked.
 *   Payload: `{ operator: '+' | '-' | '×' | '÷' }`
 *   Bubbles: yes.
 *
 * @invariants
 * - Only four operators are available: `+`, `-`, `×`, `÷`.
 * - Operators are never consumed; the same operator may be used in any number of steps.
 * - `÷` is only selectable when both operands are known and `left` is exactly divisible by `right`.
 * - `-` is only selectable when both operands are known and `left > right` (result ≥ 1).
 * - Operators use display symbols, not JS operator characters, to keep rendering decoupled from evaluation.
 */
