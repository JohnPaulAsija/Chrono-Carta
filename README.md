# ChronoCarta

*Guess the year from the map.* A browser-based educational game in the spirit of GeoGuessr — players see a rendered political map (colored regions, entity names, no dates) and pick the time period it depicts. Curators assemble maps by slicing the Seshat Cliopatria dataset for a chosen year, then write the reveal text that explains the visual tells. Pre-launch, single-player, desktop and tablet only.

## Live demo

> *TODO: live demo url* — will be filled in once Firebase App Hosting is wired up (plan Phase 4).

## Screenshots

> *Screenshots will be added once the first end-to-end gameplay slice lands (plan Phase 5+). Until then there's nothing visual to capture.*

## Setup

> *This section is a stub until the Next.js scaffold lands in Phase 1 of [the bootstrap plan](docs/plans/2026-04-29-project-bootstrap.md). It is not broken — there's just no app to run yet.*

Prerequisites (planned):
- Node.js (LTS)
- [Supabase CLI](https://supabase.com/docs/guides/cli) for migrations
- A Supabase project — see `.env.example` for the variables you'll need

Once the app exists, the canonical commands will be `npm run dev`, `npm test`, and `npm run build`. Configuration lives in `.env.local` (gitignored); copy `.env.example` as a template.

## Architecture

The full design lives in [chrono-carta-architecture.md](chrono-carta-architecture.md) — read it before contributing. It covers the high-level architecture, the two-client Supabase security model, the game-state JWT lifecycle, and the data model. [CLAUDE.md](CLAUDE.md) summarises the security invariants that are easy to violate without realising.

## Tech stack

- **Next.js** App Router (TypeScript), React Server Components, Server Actions
- **Supabase** Postgres + Auth, with Row-Level Security
- **`react-simple-maps`** for GeoJSON polygon rendering
- **Firebase App Hosting** (Cloud Run) for deploy
- **Jest + React Testing Library** for unit and component tests; **Playwright** for E2E

## Attribution

Map content is sourced from **Seshat Cliopatria**, an open-source geospatial dataset of political entities from 3400 BCE to 2024 CE, distributed under [Creative Commons Attribution 4.0](https://creativecommons.org/licenses/by/4.0/).

- Dataset: <https://github.com/Seshat-Global-History-Databank/cliopatria>
- Paper: Turchin et al., *Cliopatria: a comprehensive geospatial dataset of historical political entities*, Nature Scientific Data (2025).

The dataset's license requires attribution wherever it is presented. ChronoCarta credits Seshat Cliopatria in the README, the app footer, the reveal screen, and the credits page.

## License

The application code in this repository is released under the MIT License — see [LICENSE](LICENSE). The Cliopatria dataset is licensed separately under CC-BY 4.0 (see Attribution above).
