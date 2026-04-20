/**
 * @purpose Renders one selectable number token used in gameplay.
 *
 * @inputs
 * - `value` — the whole positive integer (≥ 1) this token represents.
 * - `id`    — a unique identifier so duplicate numeric values remain distinguishable.
 * - `used`  — boolean flag; when true the token is disabled and non-interactive.
 *
 * @fires `number-selected`
 *   Dispatched when an available token is clicked.
 *   Payload: `{ id: string, value: number }`
 *   Bubbles: yes.
 *
 * @invariants
 * - `value` is always a whole positive integer (≥ 1).
 * - Available tokens are visually interactive (blue).
 * - Used tokens are visually disabled (light grey) and do not fire events.
 * - Identity is tracked by `id`, not by `value` alone; two tokens may share a value but never an id.
 * - The `used` state is permanent within a round; it cannot be reversed except by a game reset or new game.
 */
