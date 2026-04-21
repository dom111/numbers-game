# Numbers Game — TODO

## High Priority

### Planned MVP Features

- [x] **Loading state** — Show loading UI during `New game` validation
    - [ ] Disable gameplay buttons while validating
    - [ ] Move validation to a Web Worker for true non-blocking behavior
- [ ] **Styling** — Polish UI layout, colors, spacing, fonts, and overall visual design
- [x] **Solution validation** — Verify a valid solution exists before starting each round to prevent unwinnable games
- [x] **Hint mechanism** — Provide optional hints/suggestions to help younger players progress
    - [x] Core hint engine (src/lib/hint-engine.ts) — generates hints at 4 levels
    - [x] On-demand hint display in the game UI — `Hint` button cycles through levels
    - [x] Shortest-path solver preference — hints favor fewer steps and simpler arithmetic

### UX & Accessibility

- [ ] **Mobile-responsive design** — Ensure game plays well on small screens and touch devices
- [ ] **Keyboard navigation** — Add arrow keys, Enter, Tab support for accessibility
- [ ] **Improve ARIA labels** — Better screen-reader support for all interactive elements
- [ ] **Visual feedback** — Add animations/transitions on button clicks, selections, step completion

## Medium Priority

### Gameplay Features

- [ ] **Undo last step** — Allow reverting the most recent step without full reset
- [ ] **Replay mode** — Show step-by-step walkthrough of a solution after winning
- [ ] **Difficulty levels** — Offer easy/medium/hard with adjusted number pools and target ranges
- [ ] **Game statistics** — Track games played, win rate, fastest completion times
- [ ] **URL sharing** — Encode current game state in URL for sharing specific rounds

### Game Logic Enhancements

- [x] **Solver algorithm** — Implement shortest-path solver with child-friendly tie-breaks
- [ ] **Multiple solutions** — Display alternative solution paths when multiple exist
- [ ] **Input robustness** — Edge cases, error handling, validation strengthening

## Lower Priority

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
- [ ] **Dark mode** — Optional theme toggle
- [ ] **Sound effects** — Subtle audio feedback (optional, minimal)
- [ ] **Multiplayer mode** — Future consideration for competitive play

## Notes

- **Validation solver** should be high priority before scaling the game widely; unwinnable rounds harm player experience
- **Hint system** now reuses the solver directly; future work should focus on responsiveness and UI polish
- **Mobile responsiveness** should precede broader distribution
- Prioritize items that directly improve player experience and reduce frustration
