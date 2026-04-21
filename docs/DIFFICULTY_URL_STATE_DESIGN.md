# Difficulty + URL State Design

## Goal

Add an `easy` difficulty setting now, while designing URL handling so the same parsing/serialization layer can be reused for future full game-state sharing.

## Scope (Phase 1)

- Add one new difficulty: `easy`
- Allow difficulty preselection from `location.hash`
- Keep behavior deterministic and safe with strict parsing/validation
- Preserve existing core game rules (integer-only, positive-only, token single-use by id, etc.)

## Non-goals (Phase 1)

- Full game-state sharing in URL
- Additional difficulty levels (`medium` / `hard`)
- URL migration/versioning UI (we only prepare internal hooks)

## Proposed Model

### Core enums/types

- `GameDifficulty = 'normal' | 'easy'`
- `RoundConfigSource = 'default' | 'hash' | 'attribute'`
- `ResolvedRoundConfig`:
    - `difficulty: GameDifficulty`
    - `source: RoundConfigSource`

This keeps resolution explicit and testable.

### Resolution precedence

1. Explicit component attribute (if present and valid)
2. URL hash value
3. Default (`normal`)

This mirrors likely future behavior when we add shareable links while keeping embedding flexible.

## URL Hash Schema (Phase 1)

Use key-value pairs in hash for extensibility:

- `#difficulty=easy`
- `#difficulty=normal`

Parser behavior:

- Unknown keys: ignored
- Unknown difficulty: ignored (fallback to default/next source)
- Case-insensitive read, normalized output (`easy` / `normal`)

## Easy Mode Strategy

Phase 1 target: lower cognitive load while preserving rules.

Candidate strategy (recommended):

1. Generate candidate rounds with the existing solvable-round flow.
2. Score each solution by:
    - shortest step count (primary)
    - small intermediate values (secondary)
    - simpler operator profile (tertiary)
3. Accept a round as `easy` only if it meets a threshold (for example <= 3 steps).
4. If threshold attempts fail, fall back to best-scored solvable round within bounded retries.

This avoids changing number-pool rules and keeps the mode child-friendly through solution complexity.

## Architecture for Future URL Sharing

Create a dedicated utility module (for example `src/lib/url-state.ts`) with pure functions:

- `parseHash(hash: string): Partial<UrlGameState>`
- `serializeHash(state: UrlGameState): string`
- `resolveDifficulty({ attributeValue, hash }): ResolvedRoundConfig`

Phase 1 uses only `difficulty`, but the structure is designed to expand later to:

- `numbers`
- `target`
- completed/current steps
- hint level

## Integration Points

- `src/components/game.ts`
    - Resolve difficulty at startup using attribute + hash
    - Re-resolve on `hashchange` if desired (or only on new game; decide in implementation)
    - Pass difficulty into new-game generation
- `src/types.ts`
    - Add difficulty-related shared types
- UI
    - Add difficulty selector with `normal`/`easy`
    - Keep selector behavior consistent with hash preselection

## Testing Plan

### Unit

- `src/lib/url-state.test.ts`
    - parse valid/invalid difficulty hash values
    - ignores unknown params safely
    - normalization and fallback behavior

### Component integration

- `src/components/game.test.ts`
    - hash preselects `easy`
    - invalid hash falls back to default
    - new game respects selected difficulty
    - easy mode rounds satisfy configured simplicity threshold behavior

## Risks and Mitigations

- **Risk:** Easy generation takes too long.
  - **Mitigation:** bounded retries + existing loading state + future worker migration.
- **Risk:** Hash behavior conflicts with future full share links.
  - **Mitigation:** central parser/serializer API introduced now.
- **Risk:** Difficulty meaning drifts over time.
  - **Mitigation:** explicit threshold constants and tests.

## Delivery Plan

1. Add types + URL parser utilities
2. Integrate difficulty resolution in `game.ts`
3. Add basic easy-mode generation threshold logic
4. Add tests for parsing + game integration
5. Add docs updates (`README.md`, `TODO.md`) when implementation lands

