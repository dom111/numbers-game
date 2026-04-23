# Numbers Game — TODO

## High Priority

### Planned MVP Features

- [x] **Loading state** — Show loading UI during `New game` validation
    - [x] Disable gameplay buttons while validating
    - [ ] Move validation to a Web Worker for true non-blocking behavior
- [x] **Styling** — Polish UI layout, colors, spacing, fonts, and overall visual design
    - [x] **Done** — Responsive layout, color scheme, and typography pass applied
- [x] **Deployment** — Publish app to GitHub Pages at `https://dom111.github.io/numbers-game/`
- [x] **Solution validation** — Verify a valid solution exists before starting each round to prevent unwinnable games
- [x] **Hint mechanism** — Provide optional hints/suggestions to help younger players progress
    - [x] Core hint engine (src/lib/hint-engine.ts) — generates hints at 4 levels
    - [x] On-demand hint display in the game UI — `Hint` button cycles through levels
    - [x] Shortest-path solver preference — hints favor fewer steps and simpler arithmetic
    - [x] No-hint rollback guidance — suggest removing latest step and highlight it for recovery

### UX & Accessibility

- [x] **Mobile-responsive design** — Ensure game plays well on small screens and touch devices
- [x] **Keyboard navigation** — Add arrow keys, Enter, Tab support for accessibility
- [x] **Improve ARIA labels** — Better screen-reader support for all interactive elements
- [ ] **Visual feedback** — Add animations/transitions on button clicks, selections, step completion
    - [x] Selected-number highlighting in the available numbers pool
    - [x] Easy-mode difficulty badge shown beside the target (hidden for normal mode)
    - [x] Celebration animation on win (lightweight burst effect)

## Medium Priority

### Gameplay Features

- [ ] **Undo last step** — Allow reverting the most recent step without full reset
- [ ] **Replay mode** — Show step-by-step walkthrough of a solution after winning
- [ ] **Difficulty levels**
    - [x] **Easy mode** — Add easy difficulty option that prefers short/simple solvable rounds
    - [ ] Medium/Hard follow-ups after easy mode is stable
- [ ] **Game statistics** — Track games played, win rate, fastest completion times
- [ ] **URL sharing** — Encode current game state in URL for sharing specific rounds
    - [x] First step: support URL hash preselection for difficulty (`#difficulty=easy`) using reusable parser logic
    - [ ] Extend hash state to include numbers + target for round links
    - [ ] Extend hash state to include steps/hint state for full in-progress sharing
- [ ] Using the date as a seed for daily challenges
- [ ] Time tracking (optionally, so as not to pressure younger players)

### Game Logic Enhancements

- [x] **Solver algorithm** — Implement shortest-path solver with child-friendly tie-breaks
- [ ] **Multiple solutions** — Display alternative solution paths when multiple exist
- [ ] **Input robustness** — Edge cases, error handling, validation strengthening

## Lower Priority

### Copilot Follow-ups

- [ ] **Global operators in win lock state** — Hide or disable `operator-buttons` when the game is locked for clearer UX/a11y parity with gameplay lock rules.
    - Ref: https://github.com/dom111/numbers-game/pull/2#discussion_r3117763188
- [ ] **Operator proactive-disable behavior** — Decide whether to wire active-step `left/right` into global `operator-buttons` (for proactive `-` / `÷` disabling) or remove proactive disabling and rely on `= Error` validation state.
    - Ref: https://github.com/dom111/numbers-game/pull/2#discussion_r3117763111

### Testing & Quality

- [ ] **Visual/snapshot testing** — Component rendering tests
- [ ] **E2E test suite** — Full game flows with Playwright/Cypress
- [ ] **Accessibility audit** — Formal review with axe or WAVE tools
- [ ] **Performance monitoring** — Identify and optimize bottlenecks

### Documentation & Help

- [ ] **In-game tutorial** — Guided onboarding for first-time players
- [ ] **Rules panel** — Rules/operators reference visible in the game UI
- [ ] **Strategy tips** — Help section with example solutions and hints

### Nice-to-Have

- [ ] **Keyboard shortcuts** — `R` for reset, `N` for new game, etc.
    - [ ] Ensure confirmation to avoid accidental resets
- [ ] **Dark mode** — Optional theme toggle
- [ ] **Sound effects** — Subtle audio feedback (optional, minimal)
- [ ] **Multiplayer mode** — Future consideration for competitive play
- [x] Celebration animations on win (confetti, etc.) — keep light and non-distracting for younger players
    - [x] Reduced-motion-safe sparkle/burst on win

## Notes

- **Validation solver** is now in place; unwinnable rounds are avoided by bounded-retry generation with a guaranteed-solvable fallback
- **Difficulty bands** are enforced by shortest-path length: `easy < 4` steps, `normal > 3` steps
- **URL hash state** is live for difficulty preselection; the parser/serializer layer is ready for future full game-state sharing
- **Hint system** now reuses the solver directly; future work should focus on responsiveness and UI polish
- **Mobile responsiveness and baseline keyboard/a11y support** are now in place; next UX focus is visual feedback and onboarding/help
- Prioritize items that directly improve player experience and reduce frustration
