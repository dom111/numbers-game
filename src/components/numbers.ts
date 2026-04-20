/**
 * @purpose Displays the collection of starting and derived number tokens for the current round.
 *
 * @inputs
 * - An ordered set of `Number` tokens, each with a unique `id`, a `value`, and a `used` flag.
 * - Starting tokens are generated or provided at round start; derived tokens come from completed `Step` results.
 *
 * @outputs
 * - Forwards `number-selected` events from child `Number` tokens up to the active `Step`.
 *
 * @invariants
 * - A round starts with exactly six tokens.
 * - Derived tokens (step results) are appended as new single-use tokens with fresh ids.
 * - The pool grows and shrinks as steps are completed: each step consumes two tokens and produces one.
 * - A new step can be started whenever at least two tokens remain available.
 */
