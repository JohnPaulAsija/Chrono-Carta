# Phase 13 — Player Views Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** Replace the Next.js placeholder start screen with a real one, add the credits page, add the small-viewport gate, and put the Cliopatria attribution footer on every page that the architecture says needs one.

**Architecture:** Per architecture §Key Views and §Accessibility. Start screen is a Server Component with a Play button that links to `/play`. Credits is a static Server Component listing curators (manually maintained string array for v1) plus the Cliopatria attribution. The viewport gate intercepts gameplay routes below ~768px. Footer attribution lives on every visible page.

**Tech Stack:** Same as prior phases. Mostly content + layout work.

---

## Task 1: Real start screen

**Files:**
- Modify: `app/(game)/page.tsx`

Replace the Next.js placeholder with:
- ChronoCarta title + brief explanation paragraph
- "Play" button → `/play`
- "Credits" link → `/credits`

Component test asserts the Play button links to `/play`.

Commit:
```
git commit -m "feat(start): replace placeholder with real start screen"
```

---

## Task 2: Credits page

**Files:**
- Create: `app/(game)/credits/page.tsx`

Static Server Component:
- "Curators" heading + manual list (just the project owner for v1, easy to extend).
- "Data" heading + Cliopatria attribution per architecture §GeoJSON Data Source: dataset name, license (CC-BY 4.0), link to Seshat Cliopatria GitHub, link to the Nature Scientific Data 2025 paper.
- "Open source" heading + link to the GitHub repo.

Commit:
```
git commit -m "feat(credits): credits page with curator list + cliopatria attribution"
```

---

## Task 3: Footer attribution

**Files:**
- Modify: `app/layout.tsx`

Always-visible footer (sm text, low contrast) with one-line attribution: "Map data from Seshat Cliopatria · CC-BY 4.0" linked to the dataset.

Commit:
```
git commit -m "feat(layout): footer with cliopatria attribution on every page"
```

---

## Task 4: Reveal-screen attribution

**Files:**
- Modify: `app/(game)/play/GameBoard.tsx` reveal block

Architecture says "All maps in ChronoCarta carry an attribution to the Seshat Cliopatria project." The reveal screen is a natural place — small inline note under the reveal text. (The footer covers the rest.)

Commit:
```
git commit -m "feat(reveal): cliopatria attribution shown on every reveal screen"
```

---

## Task 5: Small-viewport gate

**Files:**
- Create: `app/(game)/play/SmallViewportGate.tsx`
- Modify: `app/(game)/play/page.tsx` to wrap `GameBoard` in the gate.

Below `min-width: 768px`, render a "ChronoCarta is best on a larger screen" panel instead of the game UI. Above the breakpoint, render `{children}`.

Implementation: a Client Component with `window.matchMedia` (or simpler — a CSS-driven approach using Tailwind `hidden md:block` for the children and the inverse for the gate). Tailwind-only is cheaper, no client JS needed.

Component test asserts the gate text shows below the breakpoint, the children show above.

Commit:
```
git commit -m "feat(play): viewport gate below 768px shows 'larger screen' message"
```

---

## Task 6: Update README screenshots placeholder

**Files:**
- Modify: `README.md`

Replace the "screenshots will be added once Phase 5 lands" line — Phase 5 has long since landed but no screenshots were added. Take 2-3 screenshots of the live app (start, gameplay, reveal) and add them to a `docs/screenshots/` dir, link from README.

Commit:
```
git commit -m "docs(readme): add live screenshots from start, play, reveal"
```

---

## Task 7: E2E for the player journey

**Files:**
- Create or modify: `tests/e2e/player-journey.spec.ts`

Single spec walking the full happy path: visit `/` → click Play → complete a 2-round game → see end screen → click Credits → confirm credits content → return to start.

Commit:
```
git commit -m "test(e2e): full player journey start to credits"
```

---

## Verification before merge

- All tests pass.
- Manual: open the live preview in a browser at desktop width, confirm the start screen reads well; resize below 768px, confirm the gate kicks in on `/play` but the start and credits pages still render.

## Merge

```
git checkout main
git merge --no-ff phase/13-player-views -m "merge: phase 13 — start, credits, viewport gate, attribution"
git push origin main
```
