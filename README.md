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
- `operator-selected` (from global `operator-buttons`): `{ operator: '+' | '-' | '×' | '÷' }`
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
- If no hint is available but completed steps exist, the UI suggests removing the latest step and highlights
  that step's row/remove control as a rollback cue.
- Hint solutions prefer the fewest steps first; among equally short solutions they prefer simpler arithmetic and
  smaller intermediate values so the maths is easier to follow.
- Example chain: with `[1, 5, 7, 9, 50, 75]`, `5 × 50 = 250`, then `250 - 75 = 175`.

## Round generation

- `New game` shows a loading state while a fresh round is generated.
- Gameplay controls are disabled while generation/validation is running.
- The app retries target generation to prefer solvable rounds.
- Difficulty can be chosen as `Normal` or `Easy` from the game UI.
- Difficulty bands are based on shortest-solution length from the solver:
    - `Easy`: shortest path must be `< 4` steps
    - `Normal`: shortest path must be `> 3` steps
- If retries exhaust without finding an in-band round, the game uses the best solvable candidate found
  and logs a console diagnostic with attempt counts and elapsed time.
- If no solvable candidate is found within retries, the game falls back to a guaranteed-solvable target.
- Validation currently runs on the main thread; moving it to a worker remains a future performance improvement.

## Difficulty + URL hash

- The active mode can be preselected with hash params:
    - `#difficulty=easy`
    - `#difficulty=normal`
- Resolution precedence is: `difficulty` attribute on `<numbers-game>` > URL hash > default (`normal`).
- Changing the selector updates the hash with `history.replaceState` so links can be shared without page reload.

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

## Deployment (GitHub Pages)

This repo is configured to deploy to `https://dom111.github.io/numbers-game/` using GitHub Actions.

### One-time repository setup

1. In GitHub, open **Settings -> Pages**.
2. Set **Source** to **GitHub Actions**.

### Deploy flow

- The workflow at `.github/workflows/deploy.yml` runs on pushes to `main`.
- It runs lint + tests, then builds the app with Vite and publishes `dist` to GitHub Pages.
- Deployment sets `VITE_BASE_PATH=/numbers-game/` so asset URLs resolve correctly on project pages.

### PR checks

- The workflow at `.github/workflows/ci.yml` runs on pull requests to `main`.
- It runs format check, lint, build, and tests so PRs can be gated by required checks.

## Planned: URL game-state sharing

- Current hash support includes difficulty selection only.
- Next phase extends the same parser/serializer layer for full round/state sharing via URL.
