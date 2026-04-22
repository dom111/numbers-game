# Copilot Instructions for `numbers-game`

Use these instructions for all code changes in this repository.

## Project context

- This is a single-page browser numbers game inspired by Countdown.
- Stack: TypeScript + Web Components + Vite + Vitest.
- Core components live in `src/components`.
- Solver/hint logic lives in `src/lib`.

## Non-negotiable game rules

- A round starts with exactly six starting numbers and one target.
- Number pool per round draw (without replacement):
    - two of each `1..10`
    - one each of `25`, `50`, `75`, `100`
- All gameplay values are whole positive integers (`>= 1`).
- Valid operators: `+`, `-`, `×`, `÷`.
- Operators are never consumed (can be used any number of times).
- Tokens are identity-based (`id`), not value-based.
- Each token is single-use; completed step results become new single-use tokens.
- A step is only complete when `left`, `operator`, and `right` are present and valid.
- Invalid complete expressions show `= Error` and do not complete:
    - subtraction result `<= 0`
    - non-integer division
- Win condition: any completed step value equals the target.
- After win, gameplay controls remain locked until reset/new game.

## Step and token behavior expectations

- Supported active-step input orders:
    - `left -> right -> operator`
    - `operator -> left -> right`
    - `left -> operator -> right`
- Removing a completed step removes that step and all subsequent steps.
- Clicking selected chips in the active step removes that operand assignment.
- Hints must only use currently available token values.
- Hints must never invent duplicates that are not present in available tokens.

## Hint system requirements

- Hint generation is on-demand from the `Hint` button in `numbers-game`.
- Hint level cycles per click:
    - `NextOperands`
    - `NextOperator`
    - `NextStep`
    - `FullSolution`
- Completing a step resets hint level to `NextOperands` and clears stale hint text.
- If no hint is available and completed steps exist, suggest removing the latest step and highlight it.
- If no hint is available and there are no completed steps to remove, show `No hint available.`.
- Main game UI uses on-demand hint text rendering; do not reintroduce expensive per-render solving.
- `HintGameState.availableNumbers` is the source of truth for available values.
- Do not reconstruct available values by re-adding `completedSteps` results in `getHint`.

## Solver requirements

- Solver should prefer shortest path to solution first.
- For equally short solutions, prefer child-friendly choices:
    - smaller intermediate values
    - simpler operators where practical
    - avoid identity operations like `× 1` and `÷ 1`
- State pruning must not break tie-break correctness:
    - revisits are allowed when same-depth path score improves.
- Do not treat "target already in starting numbers" as a zero-step solved round.
    - UI/game rules require a completed step result to hit target.

## Round generation and performance

- `New game` must keep UI responsive (loading state is required).
- Generate difficulty-banded rounds using shortest-solution length from the solver:
    - `easy`: accept rounds with shortest solution `< 4` steps
    - `normal`: accept rounds with shortest solution `> 3` steps
- Fallback order when retries exhaust: best solvable out-of-band candidate → guaranteed-solvable target.
- Log retry-exhaustion diagnostics (attempt counts, elapsed time) to console when falling back.
- Any async generation timer must be tracked and cleaned up on disconnect.
- Avoid unbounded memory growth in caches.
    - Keep validator cache bounded (currently capped).

## Difficulty and URL state

- Active difficulty is resolved with precedence: `difficulty` attribute > URL hash > default (`normal`).
- `difficulty` attribute changes must not re-roll numbers or target — only update difficulty + re-render.
- `onHashChange` must use `resolveDifficulty` and check `source === 'attribute'` before deferring to the attribute; an invalid attribute value must not block hash resolution.
- `setDifficulty` must not write to the URL hash when `source === 'attribute'`.
- Difficulty selector uses a per-instance unique `id` (pattern: `difficultySelectorId`) to avoid duplicate ids when multiple `<numbers-game>` elements are on the same page.
- URL hash utilities (`parseHash`, `serializeHash`, `resolveDifficulty`) live in `src/lib/url-state.ts`.
- Selector is placed in the main controls row next to `New game`, not above the numbers pool.

- Guard parsing for component attributes:
    - numbers: finite positive integers only
    - targets: finite positive integer, otherwise safe fallback
- Never pass `NaN` or malformed values to solver/hint logic.

## Testing requirements

- Add or update tests for every behavior change.
- Prefer regression tests for bugs found in PR review/discussion.
- Maintain and extend coverage in:
    - `src/components/*.test.ts`
    - `src/lib/*.test.ts`
- Required checks before finalizing changes:

```zsh
npm run format
npm run lint
npm run build
npm test -- --run
```

## Documentation requirements

- Keep docs in sync with behavior changes:
    - `README.md`
    - `TODO.md`
    - `docs/SOLVER_DESIGN.md`
    - `docs/DIFFICULTY_URL_STATE_DESIGN.md`
- If behavior and docs conflict, update docs in the same change.

## Change style guidance

- Keep changes minimal and targeted.
- Preserve existing architecture and naming unless a refactor is justified.
- Prefer explicit, deterministic behavior over implicit heuristics.
- When fixing reviewer feedback, validate comment correctness before applying changes.
