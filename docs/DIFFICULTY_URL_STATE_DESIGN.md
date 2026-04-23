# Difficulty + URL State Design

## Status

Phase 1 is now implemented:

- `easy` difficulty is available in the UI.
- `location.hash` supports `#difficulty=easy|normal` preselection.
- Parsing and serialization live in `src/lib/url-state.ts` for future URL-sharing expansion.

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

## Implemented Model

### Core types

- `GameDifficulty = 'normal' | 'easy'` — in `src/types.ts`
- `RoundConfigSource = 'default' | 'hash' | 'attribute'` — in `src/types.ts`
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

## Difficulty Banding (Implemented)

Phase 1 uses strict shortest-path bands while preserving all core game rules:

- `easy`: accept rounds only when shortest solution length is `< 4` (that is, `<= 3`)
- `normal`: accept rounds only when shortest solution length is `> 3` (that is, `>= 4`)

Fallback order after bounded retries:

1. If an in-band candidate is found, return it immediately.
2. If no in-band candidate is found, return the best solvable out-of-band candidate for the selected mode.
3. If no solvable candidate is found at all, use the guaranteed-solvable fallback target.

Diagnostics:

- Retry exhaustion for `easy`/`normal` logs an informational console message with attempts and elapsed time.
- Full fallback to guaranteed-solvable logs a warning with attempts and elapsed time.

## URL State Utilities (`src/lib/url-state.ts`)

This module exists and provides pure functions:

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
    - Resolves difficulty at startup using attribute + hash via `resolveDifficulty`
    - Re-resolves on `hashchange` using `source === 'attribute'` check — only defers to attribute when it resolves to a valid difficulty
    - Passes difficulty into new-game generation
    - Syncs selector changes back into hash using `history.replaceState`, skipping hash writes when `source === 'attribute'`
    - Selector-driven difficulty changes immediately trigger new-round generation in the selected mode
    - `attributeChangedCallback` handles `difficulty` independently — does not re-roll numbers/target on difficulty-only changes
- `src/types.ts`
    - Exports `GameDifficulty`, `RoundConfigSource`, `ResolvedRoundConfig`, `UrlGameState`
- UI
    - Difficulty selector (`Normal`/`Easy`) in the main controls row next to `New game`
    - Selector updates hash for shareable preselected mode links and starts a new round

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
    - difficulty band helper validates `easy < 4` and `normal > 3` boundaries

## Risks and Mitigations

- **Risk:** Easy generation takes too long.
    - **Mitigation:** bounded retries + existing loading state + future worker migration.
- **Risk:** Hash behavior conflicts with future full share links.
    - **Mitigation:** central parser/serializer API introduced now.
- **Risk:** Difficulty meaning drifts over time.
    - **Mitigation:** explicit threshold constants and tests.

## Delivery Plan

1. [x] Add types + URL parser utilities
2. [x] Integrate difficulty resolution in `game.ts`
3. [x] Add difficulty banding logic with bounded retries and diagnostics
4. [x] Add tests for parsing + game integration + band boundaries + regression cases
5. [x] Docs updates (`README.md`, `TODO.md`, `docs/SOLVER_DESIGN.md`)
