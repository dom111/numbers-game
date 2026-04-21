# Numbers Game — TODO

## High Priority

### Planned MVP Features
- [ ] **Styling** — Polish UI layout, colors, spacing, fonts, and overall visual design
- [ ] **Solution validation** — Verify a valid solution exists before starting each round to prevent unwinnable games
- [ ] **Hint mechanism** — Provide optional hints/suggestions to help younger players progress

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
- [ ] **Solver algorithm** — Implement brute-force or intelligent solver to find valid solutions
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
- **Hint system** pairs well with the solver—reuse solver logic to generate hints
- **Mobile responsiveness** should precede broader distribution
- Prioritize items that directly improve player experience and reduce frustration


