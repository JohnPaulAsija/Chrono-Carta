# Phase 11 — Gameplay Backend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: superpowers:executing-plans. TDD per superpowers:test-driven-development for every function and Server Action.

**Goal:** Stand up the backend half of the gameplay loop: signed game-state JWT, option assembly, and two Server Actions (`startGame`, `submitGuess`). No UI changes — when this phase merges, calling the Server Actions from a REPL or the integration tests drives the full play loop.

**Architecture:** Per architecture §Game State Token Lifecycle and §Data Flow. JWT signed with `GAME_STATE_SECRET` via `jose`, 24-hour expiry, payload carries `maps`, `guessed`, `score`, `exp`. Token replay is an accepted v1 trade-off. `assembleOptions` reads `formatted_correct` + `formatted_wrong` from a row, returns four shuffled strings without revealing which is correct. Server Actions use `getGameClient()` (secret-key, RLS bypass).

**Tech Stack:** `jose` for JWT, Jest for unit tests of the JWT lifecycle and option assembly, integration tests for the Server Actions exercising real maps on the TEST branch.

---

## Task 1: Install `jose`

```
npm i jose
git add package.json package-lock.json
git commit -m "chore: add jose for game-state JWT signing"
```

---

## Task 2: `signToken` / `verifyToken` TDD

**Files:**
- Modify: `lib/game-state.ts` (already has `formatAnswer`)
- Modify: `tests/unit/game-state.test.ts`

**Step 1: Failing tests.**

```ts
describe("game state token", () => {
  it("round-trips a payload through sign + verify", async () => {
    const payload = {
      maps: ["uuid-1", "uuid-2"],
      guessed: {},
      score: 0,
    };
    const token = await signToken(payload);
    const verified = await verifyToken(token);
    expect(verified).toMatchObject(payload);
  });

  it("rejects a token signed with the wrong secret (tamper)", async () => {
    const token = await signToken({ maps: [], guessed: {}, score: 0 });
    const tampered = token.slice(0, -3) + "xxx";
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it("rejects an expired token", async () => {
    const token = await signToken({ maps: [], guessed: {}, score: 0 }, { expSeconds: -1 });
    await expect(verifyToken(token)).rejects.toThrow();
  });
});
```

**Step 2: Implement.**

```ts
import { SignJWT, jwtVerify } from "jose";

export interface GameStatePayload {
  maps: string[];
  guessed: Record<string, { correct: boolean }>;
  score: number;
}

const ENCODER = new TextEncoder();

function secret(): Uint8Array {
  const value = process.env.GAME_STATE_SECRET;
  if (!value) throw new Error("GAME_STATE_SECRET required");
  return ENCODER.encode(value);
}

export async function signToken(
  payload: GameStatePayload,
  opts: { expSeconds?: number } = {},
): Promise<string> {
  const exp = opts.expSeconds ?? 24 * 60 * 60;
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${exp}s`)
    .sign(secret());
}

export async function verifyToken(token: string): Promise<GameStatePayload> {
  const { payload } = await jwtVerify(token, secret());
  return payload as unknown as GameStatePayload;
}
```

**Step 3: Run, watch pass. Commit.**

```
git commit -m "feat(game-state): signToken/verifyToken with HS256 + 24h expiry"
```

---

## Task 3: `assembleOptions` TDD

**Files:** `lib/game-state.ts`, `tests/unit/game-state.test.ts`.

Tests:
- Combines `formatted_correct` + 3 strings from `formatted_wrong` into a 4-element array.
- Output order is shuffled (assert all 4 values appear regardless of order, run multiple times to satisfy non-determinism).
- Throws if `formatted_wrong` doesn't have length 3 (invariant from the schema).

```ts
export interface MapOptionsRow {
  formatted_correct: string;
  formatted_wrong: string[];
}

export function assembleOptions(row: MapOptionsRow): string[] {
  if (row.formatted_wrong.length !== 3) {
    throw new Error("assembleOptions requires exactly 3 wrong answers");
  }
  const all = [row.formatted_correct, ...row.formatted_wrong];
  return shuffle(all);
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j]!, copy[i]!];
  }
  return copy;
}
```

Commit:
```
git commit -m "feat(game-state): assembleOptions combines + shuffles four answers"
```

---

## Task 4: `startGame()` Server Action TDD

**Files:**
- Create or modify: `app/(game)/actions.ts`
- Create: `tests/integration/start-game.test.ts`

Integration test:
- Seed a couple of active maps via the service-role client (re-using the `seedTestMap` helper from Phase 3 setup).
- Call `startGame()`. Assert response shape: `{ token, geojson, options, viewport, roundIndex: 0, totalRounds }`.
- Decode token client-side (it's a JWT, the test can decode without verifying), assert `payload.maps.length === totalRounds`, `payload.guessed === {}`, `payload.score === 0`.
- Token doesn't contain `formatted_correct`, raw answers, or precision.

Implementation:

```ts
"use server";

import { getGameClient } from "@/lib/supabase/game-client";
import { signToken, assembleOptions } from "@/lib/game-state";

const ROUNDS_PER_GAME = parseInt(process.env.ROUNDS_PER_GAME ?? "10", 10);

export async function startGame() {
  const supabase = getGameClient();
  const { data: maps, error } = await supabase
    .from("maps")
    .select("id, geojson_data, center_lat, center_lng, zoom_level, formatted_correct, formatted_wrong")
    .eq("active", true);
  if (error) throw new Error(error.message);
  if (!maps || maps.length === 0) throw new Error("no active maps");

  const selected = shuffle(maps).slice(0, ROUNDS_PER_GAME);
  const first = selected[0]!;

  const token = await signToken({
    maps: selected.map((m) => m.id),
    guessed: {},
    score: 0,
  });

  return {
    token,
    geojson: first.geojson_data,
    viewport: {
      centerLat: first.center_lat,
      centerLng: first.center_lng,
      zoom: first.zoom_level,
    },
    options: assembleOptions(first),
    roundIndex: 0,
    totalRounds: selected.length,
  };
}
```

Commit:
```
git commit -m "feat(gameplay): startGame server action with 10-round JWT"
```

---

## Task 5: `submitGuess(token, guess)` Server Action TDD

Integration tests cover:
- Submitting the correct option for the current map → response includes `correct: true`, `revealText`, `formattedCorrect`, score incremented in the new token.
- Submitting a wrong option → `correct: false`, score unchanged in the new token.
- After the final map, response has `done: true`, no new token, includes per-round summary.
- Submitting with a tampered token → rejected.
- Submitting an option that doesn't match any of the four for the current map → rejected.

Implementation derives the current map from `payload.maps` minus `payload.guessed.keys()`, queries that map by id (`getGameClient`, RLS bypass), checks the guess against `formatted_correct`, builds the new payload, signs, returns the next round (or summary on completion).

Commit:
```
git commit -m "feat(gameplay): submitGuess server action with token rotation + round advance"
```

---

## Verification before merge

- All unit + integration tests pass.
- Token tamper, expiry, and replay test cases all pass.
- Build clean.

## Merge

```
git checkout main
git merge --no-ff phase/11-gameplay-backend -m "merge: phase 11 — game-state JWT + start/submit server actions"
git push origin main
```

After merge, the gameplay backend is callable but no UI exists yet. Phase 12 adds the UI.
