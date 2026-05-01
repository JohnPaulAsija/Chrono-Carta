# ChronoCarta

*Guess the year from the map.* A browser-based educational game in the spirit of GeoGuessr — players see a rendered political map (colored regions, entity names, no dates) and pick the time period it depicts. Curators assemble maps by slicing the Seshat Cliopatria dataset for a chosen year, then write the reveal text that explains the visual tells. Pre-launch, single-player, desktop and tablet only.

## Live demo

<https://chrono-carta--chrono-carta.us-east4.hosted.app/>

Deployed to Firebase App Hosting (see [apphosting.yaml](apphosting.yaml)). The root page is a **proof-of-concept demo**, not the real game flow — it shows the map viewer rendering coloured Cliopatria slices for a handful of preset years, switchable from a year picker. There's no guess-and-reveal loop yet; the curator and gameplay phases are still in progress.

## Screenshots

> *To come.* The proof-of-concept demo at `/` is the first visual surface; screenshots of the real gameplay flow will land alongside the first complete guess-and-reveal slice.

## Setup

Prerequisites:
- Node.js (LTS)
- A Supabase project (or access to the existing pre-launch project) — see `.env.example` for the variables you'll need
- [Supabase CLI](https://supabase.com/docs/guides/cli), only if you're authoring migrations

First-time setup:

```bash
npm install
cp .env.example .env.local      # fill in the Supabase keys + GAME_STATE_SECRET
npm run data:fetch              # downloads the Cliopatria geojson into public/data/ (~180 MB)
```

Day-to-day commands:

| Command | What it does |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm test` | All Jest projects (unit + integration) |
| `npm run test:unit` | Unit + component tests only |
| `npm run test:integration` | Integration suite — needs `SUPABASE_TEST_*` vars pointing at the TEST Supabase branch |
| `npm run test:e2e` | Playwright end-to-end suite |
| `npm run lint` | ESLint |

The integration suite hits a real Supabase database (the `TEST` branch of the pre-launch project), so it stays skipped locally unless you've set the `SUPABASE_TEST_*` and `TEST_*_PASSWORD` variables in `.env.local`. CI runs it on every push.

## Architecture

The full design lives in [chrono-carta-architecture.md](chrono-carta-architecture.md) — read it before contributing. It covers the high-level architecture, the two-client Supabase security model, the game-state JWT lifecycle, and the data model. [CLAUDE.md](CLAUDE.md) summarises the security invariants that are easy to violate without realising.

## Tech stack

- **Next.js** App Router (TypeScript), React Server Components, Server Actions
- **Supabase** Postgres + Auth, with Row-Level Security
- **`@vnedyalk0v/react19-simple-maps`** (React 19-compatible fork) for GeoJSON polygon rendering
- **Firebase App Hosting** (Cloud Run) for deploy
- **Jest + React Testing Library** for unit and component tests; **Playwright** for E2E

## Attribution

Map content is sourced from **Seshat Cliopatria**, an open-source geospatial dataset of political entities from 3400 BCE to 2024 CE, distributed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

- Dataset: <https://github.com/Seshat-Global-History-Databank/cliopatria>
- Paper: Turchin et al., *Cliopatria: a comprehensive geospatial dataset of historical political entities*, Nature Scientific Data (2025).

The dataset's license requires attribution wherever it is presented. ChronoCarta credits Seshat Cliopatria in the README, the app footer, the reveal screen, and the credits page.

## Updating the Cliopatria dataset

The dataset is pinned to a specific Seshat release (currently `v0.0.1`). The full file lives at `public/data/cliopatria-X.Y.Z/cliopatria.geojson` (gitignored, ~180 MB) and is mirrored in our Firebase Storage bucket so CI can fetch it without depending on Seshat's hosting.

When Seshat ships a new release and we choose to upgrade:

1. **Get the new file.** Download the new `cliopatria.geojson.zip` from the [Seshat Cliopatria releases](https://github.com/Seshat-Global-History-Databank/cliopatria/releases) page and unzip it.
2. **Mirror to Firebase Storage.** Replace the object at `chrono-carta.firebasestorage.app/cliopatria.geojson` with the new file (Firebase Console → Storage → upload, overwrite). The public-read rule is path-scoped, so the URL stays the same.
3. **Drop the new release into the repo.** Move the unzipped contents (`.geojson`, `LICENSE.md`, `README.md`, `notebooks/`) into a new folder `public/data/cliopatria-X.Y.Z/`. Delete the previous version's folder once the upgrade is committed.
4. **Update version references.** Search-and-replace `cliopatria-0.0.1` (or whatever the previous version was) across:
   - `lib/cliopatria.ts` — `DEFAULT_PATH`
   - `scripts/fetch-cliopatria.mjs` — `DEST`
   - `.github/workflows/ci.yml` — cache `key`
   - `.gitignore` — gitignore entries for the version'd folder
   - [chrono-carta-architecture.md](chrono-carta-architecture.md) and [CLAUDE.md](CLAUDE.md) — version mentions
   - This section of the README
5. **Verify.** Run `npm test` (the smoke tests parse the real file) and manually create a map in dev to confirm the schema didn't break the pre-storage pipeline.
6. **Commit:** `chore(data): bump cliopatria to vX.Y.Z`.

Schema changes between releases are possible. If a new release adds, removes, or renames fields, `lib/cliopatria.ts`'s `stripYearData` and the `MemberOf` color-family logic in `lib/map-colors.ts` may need adjustment.

## License

The application code in this repository is released under the MIT License — see [LICENSE](LICENSE). The Cliopatria dataset is licensed separately under CC-BY 4.0 (see Attribution above).
