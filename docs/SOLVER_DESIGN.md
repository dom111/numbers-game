# Solver System Design

## Overview

The solver system provides two core capabilities:
1. **Solution validation** — verify a valid solution exists for a given numbers/target pair before starting a round
2. **Hint generation** — suggest the next step in a solution path to guide players

Both features share the same underlying solver engine, which exhaustively explores the game state space.

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

### Strategy: Depth-First Search with Memoization

A backtracking algorithm that:

1. **Represents game state** as: `{ availableTokens: NumberToken[], completedSteps: StepData[], target: number }`
2. **At each state**, tries all possible two-token pairs and all four operators
3. **Evaluates** each expression:
   - If valid (positive integer result): creates a new state with result added to available tokens
   - If invalid (non-positive, non-integer): prunes that branch
4. **Checks for win**: if any step result equals the target, return solution path
5. **Memoizes** explored states to avoid recomputing identical token pools

### Pseudocode

```
function findSolution(tokens, target, history = []):
    if isEmpty(tokens):
        return null  // No tokens left, cannot continue

    for each pair (left, right) in combinations(tokens, 2):
        for each operator in ['+', '-', '×', '÷']:
            result = evaluate(left, right, operator)
            if result is valid:
                if result === target:
                    return [history, step(left, operator, right, result)]
                
                newTokens = tokens - {left, right} + {result}
                newHistory = history + [step]
                
                solution = findSolution(newTokens, target, newHistory)
                if solution exists:
                    return solution
    
    return null  // No solution from this state
```

## Data Structures

### Core Types (extend existing)

```typescript
interface SolverResult {
    found: boolean;
    steps: StepData[];
}

interface SolverState {
    tokens: NumberToken[];
    completedSteps: StepData[];
    targetValue: number;
}
```

### Memoization Key

Use a canonical representation of available tokens (sorted by value, then id) to cache explored states and avoid redundant computation.

## Implementation Plan

### Phase 1: Core Solver (`src/lib/solver.ts`)
- [ ] Implement exhaustive backtracking search
- [ ] Add memoization to prune redundant state exploration
- [ ] Export `findSolution(tokens: number[], target: number): StepData[] | null`

### Phase 2: Solution Validation (`src/lib/validator.ts`)
- [ ] Wrap solver to verify solvability before round start
- [ ] Export `isSolvable(numbers: number[], target: number): boolean`
- [ ] Cache validation results keyed by game seed/state

### Phase 3: Hint System (`src/lib/hint-engine.ts`)
- [ ] Use solver to generate solution path
- [ ] Extract next step or next N steps from solution
- [ ] Support hint levels: "Next operands" → "Next operator" → "Next step"
- [ ] Export `getHint(currentState: SolverState, level: HintLevel): HintPayload`

### Phase 4: Integration (`src/components/game.ts`)
- [ ] Check solvability on round start; reject and regenerate if unsolvable
- [ ] Connect hint UI to hint engine
- [ ] Display hint with optional "show solution" fallback

## Performance Considerations

### Complexity
- **Worst case**: O(4 × C(n,2) × depth) where n is token count, depth ≈ 6
- **Typical solvable rounds**: terminate early when solution is found
- **Unsolvable rounds**: may explore many branches before returning null

### Optimizations
1. **Early termination** — stop as soon as any solution is found
2. **Memoization** — cache explored token configurations to avoid duplicate work
3. **Pruning** — skip invalid operations (e.g., division by zero) upfront
4. **Lazy evaluation** — only compute hints on demand, not at round start

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

## Future Enhancements

1. **Multiple solutions** — collect all solutions and display alternatives
2. **Difficulty estimation** — rank solutions by "elegance" or step count
3. **Learning from player solutions** — validate custom solutions
4. **Solver visualizer** — show decision tree for educational purposes


