# ChronoCarta — Architecture Document

## Concept

A browser-based educational game in the style of GeoGuessr. Players are shown dynamically rendered political maps — colored regions with entity names — and guess what time period the map depicts. Maps are rendered from the Cliopatria geospatial dataset, an open-source academic dataset of worldwide political entities from 3400 BCE to 2024 CE. Each map has one set of multiple-choice options — the granularity depends on what's historically knowable (centuries for ancient maps, exact years for modern ones). Post-guess, a "reveal" screen explains what visual clues could have led to the answer.

## Core Game Loop

1. **Present map.** A rendered political map showing colored regions with a legend panel. Large polities display permanent labels; smaller ones show names on hover. The player explores by panning, zooming, hovering regions, and cross-referencing the legend.
2. **Guess.** Player picks from one set of multiple-choice options. The options match the map's precision level — centuries for ancient maps (e.g., "14th century BC," "5th century BC," "4th century BC," "3rd century BC"), decades for early modern maps (e.g., "1790s AD," "1800s AD," "1810s AD," "1820s AD"), or exact years for modern maps (e.g., "1812 AD," "1814 AD," "1815 AD," "1816 AD").
3. **Reveal.** Whether correct or wrong, the player sees the correct answer and the curator's explanation of visual tells. Player proceeds to the next map.
4. **End screen.** After the final map, show total score and per-round summary.

### Precision Levels

Each map record declares its **precision level**, which determines what the player is guessing and what the options look like:

- `century` — Player guesses the century. Used for maps depicting the ancient and early medieval world where the time period can only be pinpointed to a century.
- `decade` — Player guesses the decade. Used for maps depicting the late medieval through early modern world where borders and geographic knowledge shifted enough to narrow to a decade.
- `year` — Player guesses the exact year. Used for maps depicting modern periods (roughly 1700+) where political boundaries shifted fast enough to be deducible to a specific year.

### Scoring

One point per correct answer. A session score accumulates across all rounds. The maximum score equals the number of maps in the session.

## Data Model

### `maps` Table (Supabase Postgres)

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK, default `gen_random_uuid()`) | Unique map identifier |
| `title` | `text` | Display name of the map (e.g., "Congress of Vienna Europe") |
| `geojson_data` | `jsonb` | Pre-filtered GeoJSON FeatureCollection for this map's year and viewport. Contains entity polygons with Name fields but no year data. Generated at map creation time by filtering the Cliopatria dataset. |
| `correct_year` | `integer` | The year of the time period depicted by the map. Positive for AD, negative for BC (e.g., 1815 for 1815 AD, -400 for 400 BC). There is no year 0. Used by the admin panel for editing and by the creation flow to filter Cliopatria and generate `formatted_correct`. |
| `precision` | `text` (check: `century`, `decade`, `year`) | What granularity the player guesses at. Used by the creation flow to generate formatted display strings. Not sent to the client during gameplay. |
| `wrong_answers` | `jsonb` | Array of 3 integers — the wrong answer values entered by the curator. Positive for AD, negative for BC, matching the `correct_year` convention. Each value is independently signed — a single map's options can span the BC/AD boundary. Used by the admin panel for editing and by the creation flow to generate `formatted_wrong`. |
| `formatted_correct` | `text` | Pre-computed display string for the correct answer (e.g., "16th century AD," "1500s AD," "1507 AD"). Generated at creation time by `formatAnswer(correct_year, precision)`. |
| `formatted_wrong` | `jsonb` | Array of 3 pre-computed display strings for the wrong answers. Generated at creation time by running `formatAnswer` on each value in `wrong_answers`. |
| `center_lat` | `float` | Latitude for the map viewport center (e.g., 48.0 for central Europe). Set by the curator during map creation via the interactive preview. |
| `center_lng` | `float` | Longitude for the map viewport center (e.g., 15.0 for central Europe). |
| `zoom_level` | `float` | Zoom level for the map viewport. Higher values zoom in tighter. Controls how much of the world is visible and which entities' labels are legible. |
| `reveal_text` | `text` | Curator-written explanation of visual tells and historical context |
| `difficulty` | `text` (check: `easy`, `medium`, `hard`) | Subjective difficulty tag, useful for future filtering |
| `tags` | `jsonb` | Array of tag strings selected from a predefined list (e.g., `["europe", "crusades", "decolonization"]`). Ensures consistency across curators for future themed deck filtering. |
| `created_at` | `timestamptz` (default `now()`) | Record creation timestamp |
| `updated_at` | `timestamptz` (default `now()`, auto-updated via trigger) | Last modification timestamp |
| `created_by` | `uuid` (FK → `users.id`) | Which user created this map |
| `active` | `boolean` (default `true`) | Whether this map appears in the game rotation |

### `roles` Table (Supabase Postgres)

A small lookup table defining available permission levels. Seeded with three rows for v1. New roles can be added as the application grows.

| Column | Type | Description |
|---|---|---|
| `id` | `integer` (PK) | Role identifier |
| `name` | `text` (unique) | Role name: `admin`, `curator`, `player` |

Each user has exactly one role. The `admin` role implicitly includes all `curator` permissions — admin can do everything a curator can plus manage other users' maps and toggle active status. The `player` role is unused in v1 but exists to support future leaderboard accounts without a schema migration.

### `users` Table (Supabase Postgres)

Admin and curator accounts are created manually by the project admin (you) via direct database insert or the Supabase dashboard. There is no self-registration flow for v1. Supabase Auth handles authentication; this table stores profile data linked to the auth user ID.

| Column | Type | Description |
|---|---|---|
| `id` | `uuid` (PK, FK → `auth.users.id`) | Matches the Supabase Auth user ID |
| `display_name` | `text` | Public-facing display name (e.g., "Ms. Rivera") |
| `url` | `text` (nullable) | Optional link to user's site or bio |
| `role_id` | `integer` (FK → `roles.id`) | The user's permission level |
| `created_at` | `timestamptz` (default `now()`) | When the account was created |

### Display Formatting (Creation-Time)

All answer values are stored as raw integers — positive for AD, negative for BC. Formatted display strings are pre-computed once at map creation time and stored in `formatted_correct` and `formatted_wrong`. During gameplay, Server Actions read these pre-computed strings directly — no formatting logic runs at game time. The client receives an array of 4 pre-formatted display strings and doesn't know or care whether they represent centuries, decades, or years. The raw integers and precision level are never sent to the client during gameplay.

A `formatAnswer(value: number, precision: string): string` utility function in `lib/game-state.ts` handles the conversion. It is called by the map creation Server Action when a map is created or edited. The function:

1. Determines the era suffix from the sign of the value ("AD" for positive, "BC" for negative).
2. Takes the absolute value for the numeric portion.
3. Applies the precision-specific format:
   - **Century precision:** Compute the century number (`Math.ceil(absValue / 100)`), convert to ordinal ("1st," "2nd," "3rd," "4th," etc.), append "century" and era. e.g., 1507 → "16th century AD", -400 → "4th century BC".
   - **Decade precision:** Round down to the nearest ten (`Math.floor(absValue / 10) * 10`), append "s" and era. e.g., 1507 → "1500s AD", -400 → "400s BC".
   - **Year precision:** Display the absolute value directly with era. e.g., 1507 → "1507 AD", -400 → "400 BC".

**Year-zero edge case:** There is no year 0 in the historical calendar — 1 BC is immediately followed by 1 AD. The century derivation formula accounts for this: `Math.ceil(absValue / 100)` works correctly for both eras because the absolute value is always positive and non-zero (year 0 is rejected at the form level). Year 1 AD and year 1 BC are both in the "1st century" of their respective eras.

**Option assembly at game time.** The gameplay Server Actions read `formatted_correct` and `formatted_wrong` from the database, combine the four strings, shuffle them into random order, and return the shuffled array to the client. The Server Action tracks which string is `formatted_correct` so it can check the player's guess.

### Database Migrations

Schema changes are managed through Supabase CLI migration files stored in `supabase/migrations/` in the repo, version-controlled alongside the code. Each file is timestamped and applied in order.

During development, all work happens against the Supabase test project. Migration files accumulate as the schema evolves. A `supabase/seed.sql` file populates the roles table with the three initial rows (admin, curator, player) and runs after migrations.

When v1 is ready to launch, the production project is created and `supabase db push` applies all migrations at once. From that point forward, new migrations are tested against the test project first and then applied to production. During pre-launch development, the CI pipeline only needs test project credentials — production credentials don't exist until launch.

## GeoJSON Data Source

### Cliopatria Dataset

Map content is sourced from **Cliopatria**, a comprehensive open-source geospatial dataset of worldwide political entities from 3400 BCE to 2024 CE, published by the Seshat Global History Databank project (Nature Scientific Data, 2025). The dataset is distributed as a single GeoJSON file containing approximately 15,000 records representing over 1,600 political entities.

Each record contains a polity Name, polygon geometry, a FromYear-to-ToYear range, an Area estimate, a Wikipedia link, and optional MemberOf/Components fields for composite entities (e.g., states within the Holy Roman Empire). Data for any entity at any year can be obtained by filtering records where `FromYear <= year <= ToYear`.

The dataset is licensed under Creative Commons Attribution and must be credited. All maps in ChronoCarta carry an attribution to the Seshat Cliopatria project.

### Preprocessing and Storage

The full Cliopatria file is stored as a static asset on the server (in the Next.js project, not in the database). At map creation time, a Server Action filters the dataset for the curator's specified year, extracts the matching entities, and produces a stripped GeoJSON FeatureCollection for storage in the `geojson_data` column.

**Fields preserved** in the stripped output: `Name` (entity label for display and legend), `geometry` (polygon coordinates for rendering), `MemberOf` (composite entity membership, used for color families — e.g., states within the Holy Roman Empire), and a pre-assigned `color` property (see Color Assignment below).

**Fields stripped** from the output: `FromYear`, `ToYear` (would leak the answer), `Area` (unnecessary for rendering), `Wikipedia` (unnecessary for gameplay), `SeshatID` (unnecessary for gameplay), `Type`, `Components`.

This pre-filtered snapshot is what the client receives during gameplay — named, colored polygons with no temporal information.

This approach has three benefits: gameplay queries read a single JSONB column rather than filtering the full dataset on every request, the pre-filtered data contains no year information that could leak the answer, and curators can verify the data's accuracy for a specific year during the creation preview before committing it.

### Color Assignment

Entity colors are computed at map creation time and stored as a `color` property on each feature in the `geojson_data`. This ensures consistent colors between the curator preview and gameplay, and avoids shipping graph coloring logic to the client.

The `assignColors()` function in `lib/map-colors.ts` handles color assignment. The Cliopatria repo includes a processing script for adding colors to the dataset — this serves as the starting point. The function takes the filtered GeoJSON, computes polygon adjacency from the geometries (which polygons share borders), and applies a graph coloring algorithm using an 8–12 color palette to ensure no two adjacent regions share a color. The `MemberOf` field is used to assign color families to composite entities — e.g., states within the Holy Roman Empire get shades of the same hue, visually grouping them while remaining individually distinguishable.

The adjacency computation is the most expensive step but only runs once per map at creation time. The result is baked into the data and never recomputed.

### Cliopatria Loading Performance

The full Cliopatria file (~50–100 MB) is loaded into server memory on first access and cached for subsequent requests. A curator experimenting with different years triggers multiple filter operations, but after the initial load each filter is a fast in-memory scan rather than a file read. The cache persists for the lifetime of the server process. On Cloud Run, cold starts will include the initial file load (~1–2 seconds); subsequent requests within the same instance are fast.

### Data Size

Each pre-filtered year produces roughly 100–500 KB of GeoJSON data depending on how many entities exist at that time. For 50 maps, total storage is 5–25 MB in the database. Negligible on Supabase Pro. The full Cliopatria file is approximately 50–100 MB uncompressed and lives on the server filesystem, not in the database.

## Application Architecture

### Platform Stance

**Desktop-first web app.** The core gameplay depends on being able to inspect a political map — reading entity names, tracing borders, comparing regions. This is a large-screen experience. React Native and mobile-first design were considered and rejected.

- **Desktop:** Primary target. Full pan-and-zoom map interaction, side-by-side map and legend layout, generous space for multiple-choice options.
- **Tablet (landscape):** Supported. A tablet in landscape offers enough screen real estate for meaningful map inspection, especially with good pinch-to-zoom. Layout should be responsive down to ~768px width. The legend may collapse to a toggleable panel at narrower widths.
- **Phone / small viewports:** Not supported for gameplay. Below the tablet breakpoint, display a friendly message (e.g., "ChronoCarta is best experienced on a larger screen — grab a tablet or laptop for the full experience") rather than attempting to force a degraded version. The start screen, credits page, and other non-gameplay views can remain accessible at any size.

### Stack

- **Framework:** Next.js (App Router with React Server Components)
- **Hosting:** Firebase App Hosting (runs on Cloud Run under the hood, supports SSR and Server Actions natively via the Next.js Deployment Adapter API)
- **Database:** Supabase Postgres for map metadata (including pre-filtered GeoJSON), user accounts, and roles
- **Map rendering:** `react-simple-maps` for GeoJSON polygon rendering with D3 geo projections
- **Supabase clients:** Two server-side clients with distinct security profiles (see Project Structure below), plus a client-side instance for auth session management only:
  - `getGameClient()` — uses the Supabase **secret key** (Postgres `service_role`). Bypasses RLS. Used exclusively in gameplay Server Actions where there is no authenticated user and the game state token handles access control.
  - `getCuratorClient(session)` — created from the curator's JWT. Respects RLS. Used in all admin panel Server Actions. The session parameter is a natural guardrail — you can't use this client without actively extracting an auth session.
  - Client-side instance — uses `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (the `sb_publishable_*` key, which authenticates as the Postgres `anon` / `authenticated` roles). Used in the browser only for Supabase Auth session management (login, logout, session refresh). Never used for data reads or writes.

### Key Views

1. **Start screen.** Title, brief explanation, "Play" button. Server Component — static, no client interactivity needed beyond the button.
2. **Game screen.** Rendered political map with legend panel, multiple-choice buttons, round counter, running score. The map renderer, legend, and guess buttons are Client Components (interactive); the round data is fetched server-side and passed down.
3. **Reveal screen.** Shown after every guess (correct or wrong). Displays the correct answer, the curator's explanation of visual tells, and a "Next Map" button. On the final map, the button reads "See Results" and leads to the end screen.
4. **End screen.** Final score, per-round summary (each map with the player's guess, the correct answer, and whether they scored), "Play Again" button.
5. **Credits page.** Static Server Component — manually maintained list of curator names, contributions, and links to their profiles. Includes Cliopatria/Seshat attribution. No database query. Updated by hand when curators are added or removed.
6. **Admin panel** (`/admin`). Login, map creation form with interactive preview, and map management. Mix of Server and Client Components — form interactions and map preview are client-side, submissions go through Server Actions.

### Map Viewer

The map viewer is a Client Component using `react-simple-maps` to render GeoJSON polygons as an interactive political map. It occupies the main portion of the game screen with a legend panel alongside and multiple-choice options below.

**Rendering:**

- Colored polygons rendered from the `geojson_data` FeatureCollection. Each entity has a pre-assigned `color` property computed at map creation time (see Color Assignment in GeoJSON Data Source). The client reads the color directly — no color computation at render time.
- No terrain tiles or base map underneath — the visual focus is entirely on political boundaries and labels.

**Labels (three layers):**

- **Permanent labels:** Large polities whose rendered polygon area exceeds a threshold at the current zoom level display persistent centroid labels. The threshold is recalculated on zoom change — zooming in causes more labels to appear, zooming out causes smaller ones to disappear. This keeps the map readable at every zoom level.
- **Hover labels:** Hovering over any polygon displays a tooltip with the entity name. This is the primary discovery mechanism for smaller entities.
- **Legend panel:** A sidebar listing entities that don't have permanent labels — i.e., entities too small for centroid labels at the current zoom level. The legend and permanent labels are complementary: large entities are labeled directly on the map, smaller ones are identified through the legend. The legend is not viewport-filtered — it shows every unlabeled entity in the dataset regardless of whether the player has panned to see it. Clicking a legend item pans the viewport to reveal that entity. The legend updates on zoom change as entities cross the permanent-label threshold in either direction.

**Legend interaction:**

- **Hover on map polygon** — tooltip shows entity name, corresponding legend entry highlights.
- **Hover on legend item** — corresponding polygon highlights on the map (brighter color, thicker border, or glow effect).
- **Click on legend item** — polygon highlights and viewport pans/zooms to center the selected entity.
- A shared `highlightedEntity` state variable in the parent component drives both directions of the highlight. Matching a legend click to a polygon is a string comparison on the entity Name.

**Zoom and pan:**

- **Default zoom:** The map loads at the viewport center and zoom level specified in the map record (`center_lat`, `center_lng`, `zoom_level`). The curator sets this during map creation to frame the "shot" the player will see.
- **Controls:** Visible plus/minus zoom buttons and a "Reset View" button that snaps back to the curator's original framing. Positioned over the map corner so they don't consume layout space. Required for tablet users and keyboard accessibility.
- **Interaction:** Scroll wheel to zoom on desktop, pinch-to-zoom on tablet. Click-and-drag to pan. `cursor: grab` (and `grabbing` on mousedown) on the map container to signal interactivity.

**Layout:** Map occupies the left/main area. Legend panel on the right (desktop) or toggleable bottom panel (tablet). Multiple-choice options below the map. The map container has a fixed aspect ratio or max-height to ensure the options are always visible without scrolling on desktop viewports.

### Project Structure

The file layout enforces the two-client security boundary through directory separation and naming conventions. Gameplay and admin code live in separate route groups with distinct conventions about which Supabase client to use.

```
app/
├── (game)/                    # Player-facing routes — uses getGameClient()
│   ├── page.tsx               # Start screen
│   ├── play/
│   │   ├── page.tsx           # Game screen (Server Component shell)
│   │   ├── GameBoard.tsx      # Client Component (map renderer, legend, guess buttons)
│   │   └── MapViewer.tsx      # Client Component (react-simple-maps rendering, hover/highlight)
│   ├── credits/
│   │   └── page.tsx           # Credits page (static, no data fetching)
│   └── actions.ts             # Gameplay Server Actions (start game, submit guess)
│
├── (admin)/                   # Curator/admin routes — uses getCuratorClient(session)
│   ├── admin/
│   │   ├── page.tsx           # Map management view
│   │   ├── create/
│   │   │   └── page.tsx       # Map creation form with interactive preview
│   │   └── edit/[id]/
│   │       └── page.tsx       # Edit form (pre-filled)
│   ├── login/
│   │   └── page.tsx           # Curator login
│   └── actions.ts             # Admin Server Actions (create map, edit map, deactivate)
│
└── layout.tsx                 # Root layout

lib/
├── supabase/
│   ├── game-client.ts         # getGameClient() — secret key, bypasses RLS
│   ├── curator-client.ts      # getCuratorClient(session) — user JWT, respects RLS
│   └── browser-client.ts      # createBrowserClient() — publishable key, auth only
├── cliopatria.ts              # loadCliopatria(), filterByYear(), stripYearData()
├── game-state.ts              # signToken(), verifyToken(), formatAnswer(), assembleOptions()
└── map-colors.ts              # assignColors() — graph coloring for entity polygons
```

**Key conventions:**

- Server Actions in `app/(game)/actions.ts` import only from `lib/supabase/game-client.ts`. Never from `curator-client.ts`.
- Server Actions in `app/(admin)/actions.ts` import only from `lib/supabase/curator-client.ts`. Never from `game-client.ts`.
- A code review that sees a cross-import between these two boundaries is an immediate red flag.
- The `getCuratorClient(session)` function requires an auth session as a parameter. This makes accidental use in unauthenticated contexts a type error, not a silent security bug.

### Data Flow

To prevent players from inspecting correct answers via browser dev tools, game logic runs server-side in Next.js Server Components and Server Actions rather than fetching all map data to the client.

1. On game start, a Server Action selects up to `ROUNDS_PER_GAME` random active maps from Supabase (or all active maps if fewer exist) and returns the first map's `geojson_data` (pre-filtered polygons with no year information), viewport settings (`center_lat`, `center_lng`, `zoom_level`), and multiple-choice options (read from `formatted_correct` and `formatted_wrong`, combined and shuffled). A signed game state token containing the map IDs, sequence order, and initial progress is also returned. The precision level and raw integers are not sent to the client.
2. The client renders the political map from the GeoJSON data using `react-simple-maps`, applies entity colors, and displays the legend panel.
3. The player submits a guess. A Server Action receives the token and the selected display string. It verifies the token, confirms this map hasn't already been guessed, compares the selected string against `formatted_correct` from the database, and returns: whether the guess was correct, the `formatted_correct` value, the reveal text, and (if maps remain) the next map's `geojson_data`, viewport settings, and options (combined and shuffled from the next map's `formatted_correct` and `formatted_wrong`). A new token with updated progress is returned. If this was the final map, the response includes the game summary and no new token.
4. The client shows the reveal screen with the correct answer and the curator's explanation of visual tells. On non-final maps, a "Next Map" button advances to the next round using the data already received. On the final map, a "See Results" button leads to the end screen.
5. The correct answer never reaches the client until after the player has committed a guess. The signed token prevents brute-force guessing because the server rejects repeated attempts on the same map. The client cannot request data for an arbitrary map — it's always the next unguessed map in the token's sequence. The GeoJSON data contains no year information, so inspecting it reveals only entity names and shapes — which is the puzzle, not the answer.

### Game State Token Lifecycle

The game state token is a JWT signed with `GAME_STATE_SECRET` (via a library like `jose`). It carries game progress without requiring server-side session storage.

**Payload structure:**

```json
{
  "maps": ["uuid-1", "uuid-2", "uuid-3"],
  "guessed": {
    "uuid-1": { "correct": true }
  },
  "score": 1,
  "exp": 1745884800
}
```

The token contains map IDs but never correct answers. JWTs are signed, not encrypted — anyone can base64-decode the payload and read it. Knowing the map IDs tells a player nothing. The signature guarantees the server can trust the progress state hasn't been tampered with. The current map is derived from the state: the first map ID in the `maps` array that doesn't appear in `guessed`.

**Generation.** When a player clicks "Play," the `startGame` Server Action selects random active maps, reads their pre-computed `formatted_correct` and `formatted_wrong` values, builds the initial token payload (empty guessed record, score at 0), and signs it with a 24-hour expiration. The response to the client includes the signed token, the first map's `geojson_data` and viewport settings, and the first map's options (combined and shuffled from the pre-computed strings) — the options, precision level, and year data are not part of the token itself.

**Client storage.** The token lives in React state (`useState` or context). Not localStorage, not a cookie, not sessionStorage. It exists only for the duration of the game session. If the player refreshes the page, the token is gone and they start a new game. This is intentional — there's no "resume game" feature in v1, and keeping the token out of persistent browser storage means it doesn't sit around for later inspection.

**Update cycle.** Every `submitGuess` Server Action call follows the same pattern: client sends the current token and the selected display string → server verifies signature and reads progress → server compares the guess against `formatted_correct` from the database → server builds a new token with updated progress → server returns the result (correct/wrong, `formatted_correct`, reveal text, next map's `geojson_data`, viewport, and pre-computed options combined and shuffled) and the new token → client replaces its stored token. The old token is discarded client-side but not invalidated server-side — the server is stateless and has no record of prior tokens.

**Retirement.** After the final map (whether the player got it right or wrong), the Server Action returns the game summary (total score, per-round results) and no new token. The client transitions to the end screen. The last token expires naturally after 24 hours and is never used again.

**Known limitation: token replay.** Since the server doesn't track consumed tokens, a player could save the token from before a wrong guess, replay it, and try a different answer. The server would see a valid signature and progress state showing that map hasn't been guessed, so it would accept the retry. Preventing this would require server-side state (a nonce or sequence counter tracked per token), which reintroduces the session table. For an educational game with no leaderboard and no stakes, this is an acceptable trade-off in v1. The cheat requires actively intercepting and replaying HTTP requests, which is substantially more effort than inspecting a network response. If competitive features are added later, server-side token tracking should be revisited.

## Curator Admin Panel

A password-gated section of the app where authenticated curators can create and manage maps. Accessible at a route like `/admin`. No self-registration — accounts are created manually by the project admin via Supabase Auth (invite by email or direct insert).

### Authentication

Curators log in via Supabase Auth (email + password). The `/admin` route is protected by Next.js middleware that checks for a valid Supabase session and redirects to a login page if absent. Server Actions that handle map creation verify the session server-side and check the user's role before writing to the database. There is no "create account" or "forgot password" flow exposed in the UI for v1 — account creation and password resets are handled by the admin directly through the Supabase dashboard.

**Important:** Disable email sign-ups in the Supabase Auth settings (Authentication → Settings → disable "Allow new users to sign up"). By default Supabase allows anyone to create an account via the API, bypassing the UI entirely. With sign-ups disabled, only accounts created manually through the dashboard can authenticate.

### Map Creation Form

The admin panel presents a form for creating a new map. No file upload is required — the map is generated from the Cliopatria dataset.

**Step 1: Select year and preview.**

The curator enters a year (number input with AD/BC toggle). A Server Action filters the Cliopatria dataset for that year and returns the matching GeoJSON data. The form renders a live interactive preview of the resulting political map — the same `react-simple-maps` component used in gameplay. The curator can verify that the data is accurate and interesting for the game before proceeding.

**Step 2: Frame the viewport.**

The curator adjusts the preview's center and zoom level to frame the "shot" the player will see. Pan and zoom to focus on a specific region (e.g., zoom into the eastern Mediterranean for a Crusader states map, or zoom out to show all of Europe for a post-Napoleonic map). The resulting `center_lat`, `center_lng`, and `zoom_level` are captured from the preview state.

**Step 3: Enter metadata.**

- **Title** — Display name for the map (e.g., "Congress of Vienna Europe").
- **Precision level** — Dropdown: `century`, `decade`, or `year`. Determines how all answer values are formatted for display.
- **Wrong answers** — Three number inputs, each paired with its own AD/BC toggle. Each value is independently signed — a single map's options can span the BC/AD boundary. The form converts each to a signed integer before writing to the database.
- **Reveal text** — Textarea. The curator's explanation of what visual clues could have led to the correct answer. This is the educational payload of each round.

**Optional fields:**

- **Difficulty** — Dropdown: `easy`, `medium`, `hard`. Subjective assessment by the curator.
- **Tags** — Multi-select from a predefined list of tags (e.g., "europe," "africa," "americas," "southeast-asia," "ancient," "medieval," "early-modern," "modern," "crusades," "decolonization," "napoleonic," "cold-war"). The list is maintained in the codebase as a constant and can be extended as new map themes emerge. Using a predefined list ensures consistency across curators — no "crusades" vs. "Crusader States" vs. "holy land" drift — and enables clean filtering for future themed decks. Stored as JSONB array.

**Auto-populated fields (not shown in form):**

- `geojson_data` — The pre-filtered, year-stripped GeoJSON from the preview.
- `formatted_correct` / `formatted_wrong` — Generated by `formatAnswer` from the year, wrong answers, and precision.
- `created_by` — Set from the authenticated session's user ID.
- `created_at` / `updated_at` — Set by database defaults and triggers.
- `active` — Defaults to `true`. Admins can toggle this from the map management view.

### Form Validation

The form validates before submission:

- All three wrong answer fields must be filled.
- No value may be 0 (there is no year 0).
- No wrong answer may duplicate the correct year or another wrong answer. Duplicate checks compare the sign-converted values (e.g., "400 BC" and "400 AD" are not duplicates, but two entries of "400 BC" are).
- The Cliopatria preview must have loaded successfully — the curator must have seen the map before submitting.
- Reveal text must be non-empty.

Validation errors are shown inline next to the relevant field. The submit button is disabled until all required fields pass validation.

### Map Management View

Below the creation form (or as a separate tab), curators see a table of maps they have created, showing title, correct year, precision, active status, and creation date. From this view they can:

- **Edit** any of their own maps (opens the form pre-filled with existing data, including the map preview at the stored viewport).
- **Preview** a map as it would appear in gameplay.
- **Deactivate** a map (sets `active = false`, removing it from the game rotation without deleting data).

Users with the `admin` role see all maps from all curators and can edit or deactivate any of them.

### Map Creation Flow

When a curator submits the creation form, the Server Action:

1. Validates the form data (year, wrong answers, precision, reveal text).
2. Filters the Cliopatria dataset for the specified year, extracting matching entities.
3. Strips temporal and unnecessary fields (FromYear, ToYear, Area, Wikipedia, SeshatID, Type, Components) from the filtered GeoJSON, preserving only Name, geometry, and MemberOf.
4. Assigns entity colors via `assignColors()` — computes polygon adjacency, applies graph coloring with color families for composite entities, and stores a `color` property on each feature.
5. Generates pre-computed display strings by running `formatAnswer` on the correct year and each wrong answer value using the selected precision level.
6. Writes the map record to Supabase: the filtered/colored GeoJSON, viewport settings, raw values, precision, formatted strings, reveal text, and curator metadata.

The map is live and playable immediately. If a curator later edits a map's correct year, the Server Action re-filters Cliopatria, re-assigns colors, re-runs `formatAnswer`, and updates the record. Edits to wrong answers or precision only re-run `formatAnswer`.

## Environment & Configuration

Supabase API keys follow the modern naming convention: a `sb_publishable_*` key for browser-safe access (Postgres `anon` / `authenticated` roles, RLS-enforced) and an `sb_secret_*` key for server-only full access (Postgres `service_role`, bypasses RLS). The legacy `anon` JWT and `service_role` JWT formats are not used.

| Variable | Context | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Server & client | Supabase project URL. The `NEXT_PUBLIC_` prefix is required so Next.js inlines it into client bundles for the browser auth client; server code reads the same variable. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Client | Publishable key (`sb_publishable_*`). Safe for the browser; RLS enforces access. Prefixed with `NEXT_PUBLIC_` so Next.js exposes it to client components. |
| `SUPABASE_SECRET_KEY` | Server only | Secret key (`sb_secret_*`). Full database access, bypasses RLS. Used exclusively in `getGameClient()` for gameplay reads. **Must never be exposed to the client.** Stored in Firebase App Hosting's Cloud Secret Manager integration. |
| `GAME_STATE_SECRET` | Server only | Secret used to sign and verify game state JWTs. Stored alongside the Supabase secret key in Cloud Secret Manager. |
| `ROUNDS_PER_GAME` | Server | Number of maps per session (default: 10) |

**Test environment:** The integration test suite runs against a Supabase **branch** of the main project (pre-launch the same project hosts both dev on the `main` branch and tests on the `TEST` branch). Test credentials live in CI secrets or a local `.env.local` (gitignored):

| Variable | Purpose |
|---|---|
| `SUPABASE_TEST_URL` | Test branch URL |
| `SUPABASE_TEST_PUBLISHABLE_KEY` | Test branch publishable key |
| `SUPABASE_TEST_SECRET_KEY` | Test branch secret key |

## Testing

### Unit Tests (Jest)

Pure logic functions with no external dependencies. Fast, deterministic, and the first line of defense against regressions.

- `formatAnswer()` function — the creation-time display formatting utility:
  - Century precision AD: 1507 → "16th century AD", 100 → "1st century AD", 99 → "1st century AD"
  - Century precision BC: -400 → "4th century BC", -1 → "1st century BC", -100 → "1st century BC"
  - Decade precision AD: 1507 → "1500s AD", 1800 → "1800s AD"
  - Decade precision BC: -400 → "400s BC", -10 → "10s BC"
  - Year precision: 1507 → "1507 AD", -400 → "400 BC", 1 → "1 AD", -1 → "1 BC"
  - Ordinal suffixes: "1st," "2nd," "3rd," "4th" through "21st" for century labels
  - Rejects 0 (throws or returns error)
- Option assembly — combines `formatted_correct` with `formatted_wrong`, returns 4 strings. Correct answer is always present. Output order is shuffled (test that all 4 values appear regardless of order).
- Cliopatria filtering — `filterByYear(year)` returns entities where `FromYear <= year <= ToYear`. `stripYearData()` removes FromYear, ToYear, Area, Wikipedia, SeshatID, Type, and Components while preserving Name, geometry, and MemberOf. `assignColors()` adds a `color` property to each feature with no two adjacent entities sharing a color.
- Signing and verifying game state tokens — valid token round-trips correctly, tampered token is rejected, expired token is rejected.
- Form validation logic — wrong answers must not duplicate correct year or each other (comparing sign-converted values), all three required, year 0 rejected.

### Component Tests (React Testing Library + Jest)

Render individual components in a simulated DOM to verify interactive behavior without running the full app. These don't need a browser or a running server. Even lightweight tests in this layer demonstrate familiarity with the testing library and catch UI logic bugs early.

- **Map viewer:** Renders the correct number of colored polygons from GeoJSON data using pre-assigned color properties. Hovering a polygon shows the entity name tooltip. Hovering a polygon highlights the corresponding legend entry.
- **Legend panel:** Renders entity names with color swatches only for entities below the permanent-label size threshold. Hovering a legend item highlights the corresponding map polygon. Clicking a legend item triggers a viewport change. Legend updates correctly when zoom level changes (entities crossing the threshold appear or disappear from the legend).
- **Game board:** Renders the correct number of multiple-choice buttons. Clicking a button calls the guess submission handler with the right value. Score counter displays the current score. Round counter shows the correct position (e.g., "3 of 10").
- **Game board error states:** Shows "Something went wrong" with a retry button when a Server Action call fails. Shows "Your game session has expired" with a new game button when the Server Action returns a token error. Shows a fallback message when GeoJSON data fails to render.
- **Reveal screen:** Displays the correct answer and curator's reveal text. Shows "Next Map" on non-final rounds and "See Results" on the final round.
- **Map creation form:** Entering a year triggers a Cliopatria filter and renders a map preview. Validation errors appear inline when a wrong answer duplicates the correct year or another wrong answer. Submit button is disabled until required fields pass validation.
- **Map creation form error states:** Displays inline error if the Cliopatria filter returns no entities for the specified year. Displays inline error if the metadata write fails. Form state is preserved after an auth session redirect and restore cycle.
- **Small viewport gate:** The "best experienced on a larger screen" message renders below the tablet breakpoint.
- **Global error boundary:** Renders the fallback "Something went wrong" page with a link to the start screen when a child component throws.
- **Game board keyboard navigation:** Option buttons are reachable via Tab in logical order. Enter and Space both submit a guess. Focus moves to the reveal screen content after guess submission.
- **Reveal screen focus:** Focus is on the primary content when the reveal screen renders. "Next Map" button is reachable via Tab. On the final round, "See Results" is reachable instead.
- **Color-blind-safe feedback:** Correct result renders a checkmark icon and "Correct!" text. Wrong result renders an X icon and "Wrong" text. Both are present regardless of color styling.
- **Focus visibility:** Interactive elements have the custom focus ring class applied.

### Integration Tests (Supabase TEST branch + Jest)

RLS policies tested with actual database calls against the `TEST` branch of the main Supabase project. The branch carries the same migrations (via `rebase_branch`) and an isolated database, so test data never touches dev / production data and tests are not affected by real curator activity.

The TEST branch's credentials (`SUPABASE_TEST_URL`, `SUPABASE_TEST_PUBLISHABLE_KEY`, `SUPABASE_TEST_SECRET_KEY`) plus the seeded auth users' passwords (`TEST_CURATOR_PASSWORD`, `TEST_ADMIN_PASSWORD`) are stored as CI secrets and used by the test suite. The same migrations promoted to `main` are first verified against `TEST`, ensuring parity.

Test setup signs in as the seeded curator and admin via `signInAs(role)`, then exercises RLS through their user-JWT clients. Map fixtures are inserted with a `RLS_TEST_` title prefix so `cleanupTestMaps()` can delete only test data via the service-role client; real curator data carries no such prefix and is never touched.

Key test cases:

- A curator can INSERT a map with their own `created_by`.
- A curator can SELECT and UPDATE their own maps.
- A curator CANNOT update a map where `created_by` doesn't match.
- An admin can SELECT, INSERT, and UPDATE all maps.
- An anon user gets no rows from the maps table.
- An anon user gets no rows from the users table.
- A user with no row in the users table (valid JWT but no profile) is rejected by Server Actions.

### End-to-End Tests (Playwright)

Full browser automation testing the two critical user flows across Chromium, Firefox, and WebKit.

**Player flow:** Start screen → click Play → see rendered political map with legend → submit a guess → see reveal screen with correct answer and tells → continue through remaining maps → see end screen with total score and per-round summary.

**Curator flow:** Navigate to `/admin` → redirected to login → authenticate → create a map (enter year, see preview, set viewport, enter wrong answers, reveal text) → see the new map in the management view → start a new game session → verify the created map appears in gameplay with correct rendering.

**Error path E2E tests** are deferred to a future iteration. Testing server failure recovery end-to-end requires Playwright's network request interception to simulate Server Action errors, which adds complexity. The component tests above cover the error UI rendering; E2E error tests would verify the full retry and recovery flow in a real browser.

### Out of Scope for v1

Performance benchmarks, load testing, and visual regression testing. These matter at scale but not for a handful of classrooms. Noted here so the omission is deliberate, not an oversight.

## Error Handling

### Gameplay Errors

**Server Action failure (network, timeout, cold start).** The player's game state token is still valid, so the client catches the error, shows a brief "Something went wrong" message with a "Try Again" button that resubmits the same request with the same token. The token's one-guess-per-map constraint means retries don't create a cheating vector. After 3 consecutive failures, show "Game could not continue" with an option to start a new game.

**Token errors (expired, malformed, tampered).** The Server Action returns a distinct error code. The client shows "Your game session has expired" with a button to start a new game. No retry — the token is permanently invalid.

**GeoJSON rendering failure.** The GeoJSON data arrives but `react-simple-maps` fails to render it (malformed geometry, unsupported feature type). The game screen shows a fallback message but still allows the player to submit a guess — the multiple-choice options are available even if the map isn't visible. This is unlikely in practice since the data is pre-filtered and validated at map creation time.

### Admin Panel Errors

**Cliopatria filter failure.** The Server Action fails to filter the Cliopatria dataset for the specified year — either no entities exist at that year or the dataset fails to load. The preview shows an error message and the curator cannot proceed until a valid year is entered.

**Metadata write failure.** The Server Action fails to write the map record to Supabase. The error is shown inline and the curator can retry. Since there's no image upload step, there's no risk of orphaned files — the operation is a single database write.

**Server-side validation errors.** Displayed inline the same way client-side validation errors appear — the curator sees what went wrong next to the relevant field.

**Auth session expiry.** If a curator's session expires while filling out a long form, the form state is preserved in React state, the user is redirected to login, and the form is restored after re-authentication so they don't lose their work.

### Global Error Boundary

A React error boundary at the root layout catches unexpected rendering errors and shows a generic "Something went wrong" page with a link back to the start screen. This is the fallback for anything not caught by the specific handlers above.

### Logging

Server-side errors in Server Actions are logged via Firebase App Hosting's built-in Cloud Logging integration. No custom logging infrastructure for v1 — `console.error` with context (which Server Action, which map ID, error message) is sufficient for debugging. Structured logging or an error tracking service (e.g., Sentry) can be added later if error volume warrants it.

## Accessibility

The core game mechanic is inherently visual — players inspect rendered political maps and reason from entity names, borders, and spatial relationships. Full screen reader accessibility is not a goal for the gameplay itself. The following measures address the practical accessibility wins that don't conflict with the visual nature of the game.

**Keyboard navigation.** All game UI elements (multiple-choice option buttons, legend items, "Next Map," "See Results," "Play Again") are operable via keyboard using Tab, Enter, and Space. Semantic HTML (`<button>` elements, not styled `<div>`s) provides this largely for free.

**Focus management.** Focus moves logically through the game loop. After submitting a guess, focus moves to the reveal screen content. After clicking "Next Map," focus moves to the first option button for the new round. Players are never left searching for where focus went.

**Focus visibility.** A clear, consistent custom focus ring on all interactive elements. No relying on browser default outlines that CSS resets may remove.

**Color contrast.** 4.5:1 minimum for body text, 3:1 for large text and interactive elements. Enforced during UI development by checking the chosen color palette with a contrast checker tool.

**Color-blind-safe feedback.** Correct/wrong guess results are communicated with an icon (checkmark or X) and text ("Correct!" or "Wrong") alongside any color change. Feedback is readable in grayscale. Color is never the sole indicator. Note: the map's entity colors are for visual distinction, not information encoding — the legend panel provides the text-based association between colors and entity names.

**Admin panel.** The admin panel prioritizes intuitive UX over formal accessibility compliance — clean layout, clear feedback on actions, logical form flow, no training needed for someone comfortable with a standard web form.

## CI/CD

### Version Control

GitHub. `main` is production. All work happens on feature branches. Pull requests into `main` trigger the CI pipeline. Merges to `main` trigger the deploy.

### CI Pipeline (GitHub Actions)

A single workflow runs the full test suite on every pull request. All stages must pass before the PR can be merged.

1. **Lint and type check.** `eslint` and `tsc --noEmit`. Catches syntax errors and type mismatches. Under a minute.
2. **Unit tests (Jest).** Token signing/verification, display formatting, Cliopatria filtering, form validation logic.
3. **Component tests (React Testing Library + Jest).** UI behavior, error states, map rendering, legend interaction, accessibility checks (keyboard navigation, focus management, color-blind-safe feedback).
4. **Integration tests (Jest).** RLS policy verification against the dedicated Supabase test project. Requires `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, and `SUPABASE_TEST_SERVICE_ROLE_KEY` as GitHub Actions secrets.
5. **E2E tests (Playwright).** Full player and curator flows across Chromium, Firefox, and WebKit. The GitHub Actions runner starts the Next.js dev server and Playwright tests against it.
6. **Build.** `next build` to verify the app compiles. Catches import errors and build-time issues that don't surface during development.

### Deploy (Firebase App Hosting)

Firebase App Hosting connects directly to the GitHub repo and builds automatically on every merge to `main`. No GitHub Action needed for the deploy itself — Firebase handles the build, containerization, and Cloud Run deployment. Preview channels on pull requests provide a temporary URL for each PR where changes can be reviewed before merging.

### Secrets Management

Production secrets (`SUPABASE_SECRET_KEY`, `GAME_STATE_SECRET`) live in Firebase App Hosting's Cloud Secret Manager and are never referenced in CI. Test branch credentials live in GitHub Actions secrets. No secrets are committed to the repo.

## Row-Level Security

RLS policies enforce access at the database level, independent of application code. Role checks join through `users.role_id` → `roles.name`.

The two-client pattern determines which policies apply in each context:

- **`getGameClient()`** (Supabase secret key) **bypasses RLS entirely.** Gameplay Server Actions use this client to read map data (including `geojson_data`), check answers, and return reveal text for anonymous players. Access control for gameplay is handled by the signed game state token, not by RLS.
- **`getCuratorClient(session)`** (user JWT) **respects RLS.** Admin panel Server Actions use this client for all database operations. The policies below govern what curators and admins can do.

### Policies enforced via `getCuratorClient(session)`

**`maps` table:**

- **Authenticated curators:** `SELECT`, `INSERT`, `UPDATE` on rows where `created_by` matches their auth user ID. Cannot delete rows (deactivation via `active = false` instead).
- **Admins:** `SELECT`, `INSERT`, `UPDATE` on all rows. Identified by the user's role being `admin` in the `users` → `roles` join.

**`users` table:**

- **Authenticated curators:** `SELECT` on their own row only.
- **Admins:** `SELECT` on all rows. The admin panel needs cross-user reads to display curator names alongside their content (e.g. "Created by Ms. Rivera" on a map list filtered by author). Identified by the same `private.is_admin()` helper used by the maps policies.
- **No `INSERT` or `UPDATE`** for any role — account management still happens through the Supabase dashboard / service-role client, never through the app.

### Policies for anonymous access

**`maps` table:**

- **Public (anon):** No direct `SELECT` access. Player-facing reads go through `getGameClient()` which bypasses RLS, so no anon policy is needed. This ensures answer data is never exposed even if a client-side Supabase instance is misconfigured.

**`users` table:**

- **Public (anon):** No access. The credits page is a static Server Component with no database query, so no anon policy on the users table is needed.

**`roles` table:**

- **Public (anon):** No access. Role information is only used server-side in RLS policy checks and by `getCuratorClient(session)`.

### Key security invariant

The secret-key client (`getGameClient()`) is used **only** in `app/(game)/actions.ts`. The curator client (`getCuratorClient(session)`) is used **only** in `app/(admin)/actions.ts`. This boundary is enforced by project structure convention (see Project Structure above) and verified in code review. If the secret-key client is used in the admin panel, RLS is silently bypassed and curators can edit anyone's maps. If the curator client is used in gameplay, anonymous players get permission errors and the game breaks.

### CSRF and Cross-Origin Protection

Next.js has built-in CSRF protection for Server Actions — it compares the `Origin` header against the `Host` header and rejects mismatches. This prevents a malicious page on another domain from triggering Server Actions through a player's browser. Verify this is enabled at project setup; in some versions it requires an explicit `serverActions.allowedOrigins` entry in `next.config.js`.

Non-browser clients (scripts, curl) can bypass CORS entirely since it's browser-enforced. This is mitigated by the signed game state token, which enforces one-guess-per-map and correct progression regardless of how the request is made.

## Future Considerations (Not in v1)

- **Player accounts and leaderboards.** Self-registration flow that creates a user with the `player` role (already defined in the `roles` table). Add a `scores` table linked to `users.id`.
- **Tiered guessing.** Correct century guess drills into decade, correct decade drills into year. Separate wrong answer arrays per tier, weighted scoring (e.g., 1/3/5 points). Requires expanding the `wrong_answers` column into per-tier columns and adding tier tracking to the game state token.
- **Themed decks.** Curated sets of maps around a theme (e.g., "Age of Exploration," "WWI Borders," "Medieval Cartography"). Each deck would be a `decks` table with a many-to-many relationship to `maps`.
- **Timed mode.** A countdown per round for competitive play.
- **Difficulty filtering.** Let players choose easy/medium/hard or let the game adapt based on performance.
- **Educational mode.** Extended reveal screens with links to further reading, designed for classroom use.
- **Sequencing mode.** Players are shown 4–5 maps and must drag them into chronological order. Scored by pairwise correctness. Sets should be composed of maps close enough in time to be challenging — e.g., within a 200-year window or maps of the same region across eras.
- **Custom GeoJSON contributions.** Allow curators to upload custom GeoJSON data for years or entities not well-represented in the Cliopatria dataset, or to correct inaccuracies. Submitted corrections could optionally be contributed back to the Seshat project.
- **Image-based maps.** Support for curated static map images alongside GeoJSON-rendered maps, enabling maps where a historical artifact's visual style is part of the gameplay.
