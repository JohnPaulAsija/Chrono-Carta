# Phase 12 — Gameplay UI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. Component tests use superpowers:test-driven-development with @testing-library/react.

**Goal:** Compose Phases 7 (`MapViewer`) and 11 (gameplay Server Actions) into a working play loop: start → multiple-choice guess → reveal → next or end. After this phase, a player can complete a full game in production.

**Architecture:** Per architecture §Key Views (game / reveal / end). `app/(game)/play/page.tsx` is a Server Component that calls `startGame()` and renders the initial state into `GameBoard.tsx` (Client Component). `GameBoard` owns the running game state — current round's data, score, the JWT — and orchestrates `submitGuess` calls and screen transitions.

**Tech Stack:** Same as Phase 7/11 plus error-state UI patterns from architecture §Error Handling.

---

## Task 1: `app/(game)/play/page.tsx` Server Component shell

**Files:**
- Create: `app/(game)/play/page.tsx`

Server-side calls `startGame()` and passes the initial round + token + total rounds to `GameBoard` as props. Catches errors and renders an error fallback ("could not start game" with a "back to start" link).

Commit:
```
git commit -m "feat(play): server component shell calls startGame and hands off to client"
```

---

## Task 2: `GameBoard.tsx` Client Component — initial render

**Files:**
- Create: `app/(game)/play/GameBoard.tsx`
- Create: `tests/unit/GameBoard.test.tsx`

Component tests (RTL):
- Renders `MapViewer` with the initial geojson + viewport.
- Renders four option buttons with the assembled strings.
- Round counter shows `1 of 10` (or whatever totalRounds was).
- Score counter shows `0`.

Implementation: receive `initialRound`, `initialToken`, `totalRounds` as props, store as state. Render `MapViewer` + `OptionsPanel`.

Commit:
```
git commit -m "feat(play): GameBoard renders map + options + counters"
```

---

## Task 3: Submit-guess flow TDD

**Step 1: Failing test.**

```tsx
it("on guess click, transitions to reveal showing correct answer + reveal text", async () => {
  /* mock submitGuess to return correct: true, formattedCorrect, revealText */
  const user = userEvent.setup();
  render(<GameBoard initialRound={...} totalRounds={2} />);
  await user.click(screen.getByRole("button", { name: /1815 AD/ }));
  expect(screen.getByTestId("reveal")).toHaveTextContent("Correct!");
  expect(screen.getByTestId("reveal-text")).toHaveTextContent(/* known reveal text */);
});
```

**Step 2: Implement.**

`GameBoard` calls `submitGuess(token, selectedOption)`. On response: store the result in state, render the reveal screen instead of the options panel. Show "Next Map" button (or "See Results" on the final round).

Commit:
```
git commit -m "feat(play): submit-guess transitions to reveal with correct/wrong + tells"
```

---

## Task 4: Round advance TDD

Tests:
- After "Next Map" click on a non-final reveal, the new map renders, score updates, round counter advances.
- After "See Results" on the final reveal, end-screen renders.

Implementation: when `submitGuess` returned new round data, "Next Map" applies it. When it returned `done: true`, render the end screen.

Commit:
```
git commit -m "feat(play): next-map advance and end-screen handoff"
```

---

## Task 5: End screen

**Files:**
- Create: `app/(game)/play/EndScreen.tsx`
- Create: `tests/unit/EndScreen.test.tsx`

Renders:
- Final score (e.g. "7 / 10")
- Per-round summary: each map's title, the player's guess, the correct answer, an icon (check or X — color-blind-safe per architecture §Accessibility)
- "Play Again" button → routes back to `/play` (which kicks off a new game)

Tests cover the rendering of correct/wrong rows, "Play Again" navigation.

Commit:
```
git commit -m "feat(play): end screen with per-round summary + play-again"
```

---

## Task 6: Error-state UI

Per architecture §Gameplay Errors:
- Server Action failure → "Something went wrong" + retry. After 3 consecutive failures, "Game could not continue" + new-game.
- Token error (expired/tampered) → "Your game session has expired" + new-game.
- GeoJSON render failure → fallback message; options still operable.

Tests cover each branch. Implementation lives in `GameBoard` as state machines around the response shape.

Commit:
```
git commit -m "feat(play): error states for server action, token, and rendering failures"
```

---

## Task 7: E2E happy path

**Files:**
- Create: `tests/e2e/play-loop.spec.ts`

Plays a full game (2 rounds is enough to exercise both round-advance and end-screen) from `/` → "Play" → submit guesses → end screen. Use the test maps seeded by Phase 9 + 10 (or seed two via service role at test start).

Commit:
```
git commit -m "test(e2e): full play loop start to end screen"
```

---

## Verification before merge

- All component + E2E tests pass.
- Manual: play a full game on the live preview.
- Accessibility checklist (architecture §Accessibility): keyboard navigation, focus management on round advance, color-blind-safe feedback.

## Merge

```
git checkout main
git merge --no-ff phase/12-gameplay-ui -m "merge: phase 12 — playable game loop"
git push origin main
```
