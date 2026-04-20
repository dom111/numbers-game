/**
 * @purpose Stores and renders the ordered list of player-created `Step` items.
 *
 * @inputs
 * - History of `StepData` records: `{ id: string, left: number, operator: string, right: number, value: number }[]`.
 * - Index of the currently active (incomplete) step.
 *
 * @fires `steps-changed`
 *   Dispatched when the step list is created, updated, or a step is finalized.
 *   Payload: `{ steps: StepData[] }`
 *   Bubbles: yes.
 *
 * @invariants
 * - Only one step is active at a time; it is always the most recently created incomplete step.
 * - When a step is completed, its `value` is immediately added to the available token pool as a
 *   new single-use token, and the two tokens consumed as operands are marked as used.
 * - A result token behaves identically to a starting token: it has a unique `id`, a `value`,
 *   and can be selected as the `left` or `right` operand of any subsequent step.
 * - A token produced by a step may only be used once; it is consumed when selected in a subsequent step.
 * - There is no limit on the number of steps; the player may keep adding steps for as long as
 *   there are at least two available tokens remaining.
 * - Not all steps need to be completed, and not all tokens need to be used.
 */
