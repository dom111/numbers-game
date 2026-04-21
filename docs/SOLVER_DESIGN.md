# Solver System Design

## Overview

The solver system provides two core capabilities:

1. **Solution validation** — verify a valid solution exists for a given numbers/target pair before starting a round
2. **Hint generation** — suggest the next step in a solution path to guide players

Both features share the same underlying solver engine, which searches for the shortest valid solution path and then uses human-friendly tie-break rules for hint quality.

## Problem Statement

Given:

- A set of starting number tokens (6 values)
- A target integer
- Four allowed operators: `+`, `-`, `×`, `÷`

Find: Any sequence of valid steps that produces a final result equal to the target.

### Constraints

- All intermediate results must be whole positive integers (≥ 1)
- Each starting number token may be used at most once per game
- Completed step results create new tokens available for subsequent steps
- Order of step completion is irrelevant as long as dependencies are respected

## Algorithm Approach

### Strategy: Shortest-Path Search with Human-Friendly Tie-Breaks

The solver now searches by **fewest steps first**, then ranks equally short candidates by how easy
they are to reason about:

1. **Represents game state** as the multiset of currently available token values.
2. **Uses breadth-first search** so the first solution depth found is guaranteed to be shortest.
3. **Generates valid expressions** from all unordered token pairs.
4. **Ranks same-depth moves** to prefer:
    - smaller intermediate values
    - operators that are typically easier for children (`-`, `+`, then `×`, then `÷`)
    - avoidance of unnecessary identity steps such as `× 1` or `÷ 1`
5. **Caches visited value-multiset states** to avoid recomputing equivalent positions.

### Pseudocode

```
function findSolution(tokens, target):
    queue = [initialState(tokens)]
    visited = { canonicalValueMultiset(tokens) }

    while queue is not empty:
        state = queue.shift()
        moves = rankMovesBySimplicity(generateValidMoves(state, target))

        for move in moves:
            if move.result === target:
                return state.history + [move.step]

            nextState = apply(move)
            if canonicalValueMultiset(nextState.tokens) not in visited:
                visited.add(canonicalValueMultiset(nextState.tokens))
                queue.push(nextState)

    return null
```

## Data Structures

### Core Types

```typescript
interface SolverResult {
    found: boolean;
    steps: SolverStep[];
}

interface SolverState {
    tokens: SolverToken[];
    steps: SolverStep[];
}
```

### Memoization Key

Use a canonical representation of available token values (sorted ascending) to cache explored states and avoid redundant computation.

## Implementation Plan

### Phase 1: Core Solver (`src/lib/solver.ts`)

- [x] Implement shortest-path search for hint generation
- [x] Add visited-state caching to prune redundant exploration
- [x] Export `findSolution(numbers: number[], target: number): SolverResult`

### Phase 2: Solution Validation (`src/lib/validator.ts`)

- [x] Wrap solver to verify solvability before round start
- [x] Export `isSolvable(numbers: number[], target: number): boolean`
- [x] Cache validation results keyed by number multiset + target

### Phase 3: Hint System (`src/lib/hint-engine.ts`)

- [x] Use solver to generate solution path
- [x] Extract the next operands/operator/step or full solution from that path
- [x] Support hint levels: "Next operands" → "Next operator" → "Next step" → "Full solution"
- [x] Export `getHint(currentState: HintGameState, level: HintLevel): Hint | null`

### Phase 4: Integration (`src/components/game.ts`)

- [x] Check solvability while generating new rounds and retry target selection
- [x] Connect hint UI to hint engine
- [x] Display hints on demand in the game UI
- [x] Reuse shortest-path results for `easy` difficulty round selection

## Performance Considerations

### Complexity

- **Worst case**: O(4 × C(n,2) × depth) where n is token count, depth ≈ 6
- **Typical solvable rounds**: terminate early when solution is found
- **Unsolvable rounds**: may explore many branches before returning null

### Optimizations

1. **Shortest-path search** — find the fewest steps first
2. **Visited-state caching** — avoid revisiting equivalent token multisets
3. **Pruning** — skip invalid and low-value identity operations (for example `× 1`, `÷ 1`)
4. **Lazy evaluation** — only compute hints on demand, not during normal render
5. **Loading state** — keep the UI responsive while main-thread validation runs

### Target Metrics

- Validation should complete in < 100ms for typical rounds
- Hint generation should respond in < 50ms

## Testing Strategy

### Unit Tests (`src/lib/solver.test.ts`)

- Test solver on known solvable cases (e.g., Countdown examples)
- Test on known unsolvable cases
- Test edge cases (single token, target equals a number, etc.)

### Integration Tests (`src/components/game.test.ts`)

- Verify solvability check prevents unwinnable rounds
- Verify hint system returns valid next steps
- Verify hint path actually leads to solution

### Performance Tests

- Measure solver time on worst-case unsolvable inputs
- Ensure validation doesn't block game initialization

## Current UX Notes

- Hint generation is triggered only when the player clicks `Hint`.
- Hint progression cycles through operands → operator → step → full solution.
- Completing a step resets hint progression back to the first level.
- New-round validation still runs on the main thread; a Web Worker is the next logical performance upgrade.
- Difficulty bands are enforced from shortest-path length:
    - `easy` accepts `< 4` steps
    - `normal` accepts `> 3` steps
- If retries exhaust without an in-band result, generation falls back to best available solvable candidate and
  logs retry diagnostics.

## Future Enhancements

1. **Multiple solutions** — collect all solutions and display alternatives
2. **Difficulty estimation** — rank solutions by "elegance" or step count
3. **Learning from player solutions** — validate custom solutions
4. **Solver visualizer** — show decision tree for educational purposes
