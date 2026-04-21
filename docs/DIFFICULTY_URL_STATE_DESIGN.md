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
    - Re-resolve on `hashchange` when no explicit `difficulty` attribute is present
    - Pass difficulty into new-game generation
    - Sync selector changes back into hash using `history.replaceState`
- `src/types.ts`
    - Add difficulty-related shared types
- UI
    - Difficulty selector with `normal`/`easy`
    - Selector updates hash for shareable preselected mode links

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

1. Add types + URL parser utilities
2. Integrate difficulty resolution in `game.ts`
3. Add basic easy-mode generation threshold logic
4. Add tests for parsing + game integration
5. Add docs updates (`README.md`, `TODO.md`) when implementation lands
