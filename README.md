# Numbers game

Single-page browser game inspired by the Countdown numbers round.

## Core rules

- A round starts with six drawn numbers and one target.
- Number draws come from this pool (without replacement per round):
    - two of each `1..10`
    - one each of `25`, `50`, `75`, `100`
- All values in gameplay are whole positive integers only (`>= 1`).
- Supported operators are `+`, `-`, `×`, `÷`.
- Operators are never consumed: each can be used any number of times.
- Each number token is single-use and tracked by unique `id` (not by value).
- Completed step results become new single-use tokens for later steps.
- Win condition: any completed step value equals the target.
- After winning, gameplay controls are locked until reset/new game.

## Step behavior

A step is formed from `left`, `operator`, `right`. Input order is flexible:

- `left` -> `right` -> `operator`
- `operator` -> `left` -> `right`
- `left` -> `operator` -> `right`

When all three are present:

- valid expression: step completes, is appended to history, and its value is added as a new token
- invalid expression: step shows `= Error` and does **not** complete

Invalid means:

- subtraction result would be `<= 0`
- division would be non-integer (remainder)

## Event contracts

- `number-selected` (from each `number-token`): `{ id: string, value: number }`
    - `value` is the whole positive integer represented by that token.
- `operator-selected` (from active step operator buttons): `{ operator: '+' | '-' | '×' | '÷' }`
- `step-complete` (from active step): `{ id, left, operator, right, value }`
    - `value` is the evaluated result of that step equation.
- `steps-changed` (from steps list): `{ steps: StepData[] }`
    - Contains valid completed steps only; steps showing `Error` are excluded.

## Token and step lifecycle

- Tokens are identity-based (`id`), not value-based. Duplicate values are valid when ids differ.
- Clicking a selected operand chip in the active step removes that operand assignment.
- Removing a completed step removes that step and all later steps.
- A completed step always contributes exactly one new result token.
- Hints are generated from the token values currently available to the player; consumed tokens and nonexistent
  duplicates must not be suggested.
- Hint requests are on-demand. Each press of the `Hint` button advances through:
    - next operands
    - next operator
    - next full step
    - full solution
- Completing any step resets hint progression back to the first level for the next request.
- Hint solutions prefer the fewest steps first; among equally short solutions they prefer simpler arithmetic and
  smaller intermediate values so the maths is easier to follow.
- Example chain: with `[1, 5, 7, 9, 50, 75]`, `5 × 50 = 250`, then `250 - 75 = 175`.

## Round generation

- `New game` shows a loading state while a fresh round is generated.
- The app retries target generation to prefer solvable rounds.
- Validation currently runs on the main thread; moving it to a worker remains a future performance improvement.

## Development

```zsh
npm install
npm run dev
```

```zsh
npm run lint
npm run build
npm test
```
