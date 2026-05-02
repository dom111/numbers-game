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
    - full solution
- Completing any step resets hint progression back to the first level for the next request.
- Each successful hint request starts a 30-second cooldown; during cooldown the `Hint` button is disabled and
  shows the remaining seconds.
- For daily puzzles, the first hint level is free. Escalating to the operator hint (and anything beyond it for
  that in-progress step) counts as one paid hint used.
- If no hint is available but completed steps exist, the UI suggests removing the latest step and highlights
  that step's row/remove control as a rollback cue.
- Hint solutions prefer the fewest steps first; among equally short solutions they prefer simpler arithmetic and
  smaller intermediate values so the maths is easier to follow.
- Example chain: with `[1, 5, 7, 9, 50, 75]`, `5 × 50 = 250`, then `250 - 75 = 175`.
- Keyboard support includes Tab/Shift+Tab for control traversal, Enter/Space to activate controls, arrow-key
  navigation within number-token and operator groups, and Up/Down movement between numbers, operators, and
  game controls.
- Within the bottom game-controls row, Left/Right/Home/End move focus across `Reset`, `Hint`, `New game`, and
  the difficulty selector.
- Up/Down group navigation intentionally does not override native ArrowUp/ArrowDown behavior on the difficulty
  select control.

## Round generation

- `New game` shows a loading state while a fresh round is generated.
- Gameplay controls are disabled while generation/validation is running.
- The app retries target generation to prefer solvable rounds.
- Difficulty can be chosen as `Normal` or `Easy` from the game UI.
- Changing difficulty from the selector immediately generates a fresh round at the new difficulty without
  changing the game mode (daily vs random), unless a valid `difficulty` attribute is controlling the component.
- Difficulty bands are based on shortest-solution length from the solver:
    - `Easy`: shortest path must be `< 4` steps
    - `Normal`: shortest path must be `> 3` steps
- If retries exhaust without finding an in-band round, the game uses the best solvable candidate found
  and logs a console diagnostic with attempt counts and elapsed time.
- If no solvable candidate is found within retries, the game falls back to a guaranteed-solvable target.
- Validation currently runs on the main thread; moving it to a worker remains a future performance improvement.

## Accessibility and UI polish

- Interactive regions include explicit ARIA labels (numbers, operators, controls, steps, target, and hint/status).
- Hint/loading messages are announced as polite live regions.
- Winning triggers a decorative celebration on the game board and a temporary target animation (grow + color-gradient shift); it is visual-only (no extra live-region announcements).
- Under `prefers-reduced-motion: reduce`, win-celebration motion is disabled.
- Mobile/touch sizing keeps interactive controls at touch-friendly heights.
- `New game` is styled as the primary call-to-action while keeping reset/hint as secondary controls.
- Easy mode shows a small visual badge beside the target; normal mode intentionally omits it.
- On win, the board also shows a rating based on efficiency versus the shortest solver path:
    - `3/3` stars: matched shortest path
    - `2/3` stars: shortest + 1..2 moves
    - `1/3` stars: shortest + 3 or more moves

## Difficulty + URL hash

- The active mode can be preselected with hash params:
    - `#difficulty=easy`
    - `#difficulty=normal`
- Daily mode can also be preselected:
    - `#mode=daily`
    - `#difficulty=easy&mode=daily`
- Resolution precedence is: `difficulty` attribute on `<numbers-game>` > URL hash > default (`normal`).
- `mode` is hash-driven (`daily` or `random`), and `random` is omitted from hash serialization as the default.
- Changing the selector updates the hash with `history.replaceState` so links can be shared without page reload,
  except when a valid `difficulty` attribute is authoritative.
- Selector changes also start a new generated round for the newly selected mode, except when attribute control
  causes the selector change to be ignored.
- Hash changes that alter mode/difficulty trigger round regeneration, while a valid `difficulty` attribute still overrides hash difficulty.
- Daily puzzle generation is deterministic by UTC date key (`YYYY-MM-DD`) + difficulty so everyone gets the same puzzle regardless of locale/timezone.
- Daily completion is persisted per `date + difficulty` in `localStorage` (easy/normal tracked independently).
- Daily completion stores move count, shortest-path length, star rating, and paid hint count so restored daily wins keep the same summary.
- Re-opening a completed daily puzzle restores the completed steps, lock state, and win celebration.
- Switching difficulty in daily mode re-checks persisted completion for that difficulty and restores win state when applicable.
- Daily wins expose a `Share result` action that prefers Web Share API and falls back to clipboard copy when available.

## Development

```zsh
npm install
npm run dev
```

```zsh
npm run lint
npm run build
npm test
npm run css:unused
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
- It runs format check, a non-blocking CSS unused-selector scan, lint, build, and tests so PRs can be gated by required checks.

## Planned: URL game-state sharing

- Current hash support includes difficulty + mode selection.
- Next phase extends the same parser/serializer layer for full round/state sharing via URL.
