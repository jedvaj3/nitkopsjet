# AGENTS.md

This document describes the NitkoSjet project for developers and AI agents working on this codebase.

## Project Overview

**NitkoSjet** (nitkosjet.fun) is a Croatian-language quiz game in the style of a "pointless" TV quiz: each question has 13–25 correct answers, each pre-scored 0–100 (how many of 100 surveyed people named it). The player wants the **lowest** score; a correct 0-point answer is a "NitkoSjet!" jackpot, a wrong/timed-out answer scores 100.

Local modes run entirely in the browser (`localStorage` for leaderboard + preferences). **Online rooms** use a TanStack Start server route (`src/routes/api.room.ts`) backed by Netlify Database (one `rooms` row per room, JSON state, `version` column for optimistic concurrency). There is no sign-up: players get a random id + token per room, stored in `localStorage`. All UI copy is Croatian.

### Tech Stack

| Layer         | Technology                                                |
| ------------- | --------------------------------------------------------- |
| Framework     | TanStack Start (single route `/`)                         |
| Frontend      | React 19, TanStack Router                                 |
| Styling       | Tailwind CSS 4, theme + stage styles in `src/styles.css`  |
| Fonts         | Unbounded (display) + Manrope (body), Google Fonts        |
| Sound         | Web Audio API synth (`src/game/sound.ts`), no audio files |
| Confetti      | Hand-written canvas effect (`src/game/confetti.ts`)       |
| Toasts/Dialog | sonner, shadcn/ui Dialog                                  |
| Deployment    | Netlify, via `@netlify/vite-plugin-tanstack-start`        |

## Directory Structure

```
src/
├── game/                 # Pure game logic and data (no React)
│   ├── types.ts          # Question/Answer/Round/Turn/GameConfig types
│   ├── questions.ts      # CATEGORIES + QUESTIONS database (40 standard questions, 5 per category)
│   ├── adult/            # 18+ questions split by sub-topic (pitanja18_*.ts) + adult.test.ts content checks
│   ├── extra/            # additional standard questions, one file per category + extra.test.ts
│   ├── match.ts          # Tolerant answer matching (case, diacritics, alts, surnames, typos)
│   ├── engine.ts         # Rules constants, question picking, share text, Croatian plural `bodova()`
│   ├── storage.ts        # localStorage leaderboard + prefs, `totalFor()` helper
│   ├── sound.ts          # Web Audio sound effects (`sfx.*`), mute state
│   └── confetti.ts       # `fireConfetti()` canvas burst
├── components/game/
│   ├── Menu.tsx          # Hero, category grid, mode, timer, player names
│   ├── PlayTurn.tsx      # Question, answer input, timer, then score-column reveal
│   ├── ScoreColumn.tsx   # Animated 100 → score column with tick sounds
│   ├── RoundSummary.tsx  # Per-round recap, hidden 0–5 point "gems", full answer list
│   ├── FinalScreen.tsx   # Solo result + leaderboard save / duel winner, share, replay
│   └── Leaderboard.tsx   # Leaderboard list
├── routes/
│   ├── __root.tsx        # HTML shell (lang="hr", class="dark"), meta, fonts
│   └── index.tsx         # Game state machine: menu → (handoff) → turn → summary → final
└── styles.css            # Dark navy/violet palette, neon cyan & gold accents, column/animation classes
```

## Game Rules (as implemented)

- **Solo izazov**: 5 rounds, one answer per round, total is saved to the local leaderboard (lowest first, top 20).
- **Dvoboj**: 2 players, 3 rounds, 2 lives each. Both answer the same question per round (starting player alternates; an answer already used that round is rejected without penalty). Higher points in a round loses a life; tie = no life lost. Game ends early when someone reaches 0 lives. Winner: more lives, then lower total.
- **Timovi 2 na 2**: 4 players in 2 teams, 3 rounds, 2 lives per team. Seats are interleaved `[A1, B1, A2, B2]` (`config.players`, team names in `config.teams`) so teams alternate answering. A team's round score is the sum of both members; the higher team loses a life.
- **Svatko za sebe**: 3–5 players, 3 rounds, no lives; lowest total wins, equal totals share a place.
- Multiplayer logic is expressed through "sides" in `engine.ts` (`sideOf`, `sideName`, `roundSidePoints`, `standings`, `turnOrder`): a side is a team in teams mode, otherwise a single player. Turn order rotates by one seat each round.
- **Timer**: 0 (relaxed), 30 s, or 15 s. Timeout = 100 points.
- Single-category games with fewer questions than rounds are topped up from other categories (`pickQuestions`).
- **18+ category** (`odrasli`, `src/game/adult/`): flagged `adult` in `CATEGORIES`, never part of the mix or top-ups, requires the `AgeGate` confirmation (remembered as `prefs.adultConfirmed`).
- **Online rooms** (`src/online/`): `logic.ts` holds the pure, server-authoritative rules (join, start, answer, timeouts, skipping absent players, host hand-over, `toPublic()` which hides tokens and answer lists until a round ends). `server.ts` loads/stores rooms with retries; clients poll `GET /api/room?code=` every 4 s while the tab is visible and not at all in the background (`useRoom`). Invite link: `/?soba=CODE`. Up to 8 players, 3–10 rounds, 20–60 s timer, lowest total wins. Time-based progress happens lazily in `tick()` on every poll, so no background job is needed.
- **Answer judge** (no AI, no network): `judgeOffline` in `src/game/meaning.ts` — exact phrase/alias match (`matchExact`), then typos (up to 2 per word on longer words, `matchAnswer`), Croatian inflections and word roots (`matchMeaning`/`matchOverlap`). Only a recognisable listed answer counts; everything else scores 100. Local games run it in the browser (`src/game/judgeClient.ts`); online rooms run the same function on the server inside the room write. Use `answerLabel()` / `isCorrect()` instead of checking `answerIndex` directly.
- **No repeats + anti-cheat rotation**: `pickFromCategories(…, played)` prefers unplayed questions; `markPlayed` resets a category once it's exhausted. Local games keep the played set and per-question play counts in `localStorage` (`src/game/session.ts`), online rooms in `RoomState.played` / `RoomState.playCounts`. A repeated question is played as `rotateQuestion(q, timesPlayedBefore)` (`src/game/rotate.ts`, deterministic): a different 1–10 (or 1–20) point answer becomes the 0-point one and old 0-point answers move to 15–25. Online rounds store `variant` and the server uses `roundQuestion(round)`.
- **Finale format** (`src/game/trio.ts`, default for multiplayer, `GameConfig.format` / `RoomSettings.format`, `'classic'` keeps 1 answer per turn): each player writes 3 answers (`TrioFields`, own duplicates blocked by text or meaning). Then answers are revealed slot-major over the seat order (`trioSequence`). An answer already revealed this round triggers a no-penalty replacement (`ROUND_DUPLICATE_MSG`, 15 s online). Online phases: `input` (simultaneous, `lock` action judges all 3 in parallel) → `reveal` / `replace` → `summary`; locked answers stay server-side until revealed. Local: `TrioEntry` per player (hand-off) → `TrioReveal` on the shared screen. A player's round score is the sum of their 3 answers (empty field = 100).
- **Reactions** (online only): players not on turn get 😂🔥💀🤡🤫 buttons during `turn`/`reveal`/`replace`; reactions are queued on the client and sent with the next poll as `&r=😂,🔥` (`reactBatch`, no request of their own), stored in `RoomState.reactions` (10 s TTL, 600 ms per-player gap), clients fly each one over the current player's desk for ~2.5 s.
- **End of game**: `Podium` (2–1–3, characters, totals) + one fun title per player from `assignTitles` (`src/game/titles.ts`: Srećković, Kralj 18+ zone, Magnet za stotke, Hodajući zicer, Vječni filozof, Lovac na bisere, Kreativac, Munja, fallbacks). Turns record `ms` (answer time) for the speed titles. `podiumShareText` builds the WhatsApp summary.
- **Sound & panic**: `sfx.crowdCheer` (0–5 points) / `sfx.crowdAww` (100) fire from `ScoreColumn`; `sfx.podium` on the podium. `usePanic(secondsLeft, audible)` drives the last-10-seconds red pulsing glow (`.panic-glow`), shaking inputs (`.panic-shake`) and a speeding heartbeat.
- **TV studio UI** (`src/components/online/`): SVG characters (`Avatar.tsx`, gallery in `src/online/avatars.ts`) with moods idle/thinking/happy/sad, desks with name + total, speech bubbles, the shared `ScoreColumn` in the centre. Animations live at the end of `src/styles.css`.

## Adding Questions

Add a `q(id, category, text, answers, { hint, surnames })` entry in `src/game/questions.ts`. Answers are tuples `[displayText, points, ...alternativeSpellings]`. Guidelines:

- Lists should be complete (every correct answer present) — anything missing counts as wrong (100 points).
- Well-known answers ~70–95, medium 20–50, obscure 0–5; include at least 2–3 answers at ≤5 points.
- An alternative starting with `~` is a keyword stem (written without diacritics): the answer is accepted when any input word starts with it, or the phrase appears, as long as only one answer matches. Use it for free-text answers (18+ questions) and add inflected stems (`~auto`, `~autu`).
- Alternatives don't need diacritic or case variants (normalization handles that); add English names, nicknames, common misspellings.
- `surnames: true` auto-accepts a surname alone when it is unique within that question.
- Keep `id` unique; it is used as a React key.

## Non-obvious decisions

- `localStorage` is read in `useEffect` on screens that are server-rendered (menu, root). `FinalScreen` reads it in `useState` initializers because it only ever mounts client-side after gameplay.
- Audio context is created lazily and unlocked on the first user click (`unlockAudio`) for iOS/Safari.
- Fuzzy matching only accepts a typo match if it resolves to exactly one answer, so "Iron Man 4" is rejected rather than guessed.
- Points are illustrative survey values, not real survey data; the footer says so.

## Key Concepts

### File-Based Routing

Route files in `src/routes/` define pages and endpoints:

- `__root.tsx` wraps every page.
- `index.tsx` is `/`.
- `about.tsx` would be `/about`.
- `api.*.ts` files are server API endpoints. See the `tanstack-start-api-routes` skill.

### Theme Variables

Colors and corner radius are CSS variables in `src/styles.css` (`--background`, `--foreground`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--radius`, and more), with a second set under `.dark`. Tailwind exposes them as classes such as `bg-primary`, `text-muted-foreground`, and `border-border`.

Set these variables for the product before you build any page. In components, use the variable classes instead of raw colors like `bg-white` or `text-gray-600`, so the whole site changes when a variable changes.

### UI Components

Ready-made components are in `src/components/ui/`. Use them before writing your own, and restyle them through the theme variables or their variants. Add more with `npx shadcn add <name>`. Show a toast by calling `toast()` from `sonner`; the container is already mounted in `__root.tsx`. `TooltipProvider` is mounted there too, so `Tooltip` works anywhere without its own provider.

| Need               | Components                                                         |
| ------------------ | ------------------------------------------------------------------ |
| Actions and status | Button, Badge, Progress, Skeleton, Alert, Sonner                   |
| Forms              | Input, Textarea, Label, Checkbox, RadioGroup, Switch, Select, Form |
| Overlays and menus | Dialog, Sheet, Popover, DropdownMenu, Tooltip                      |
| Content and layout | Card, Tabs, Accordion, Separator, Table                            |

Use `Form` with React Hook Form and the Zod resolver. Start from `src/examples/validated-form.tsx`; it isn't mounted or connected to a backend. Its required `onSubmit` callback must reject on failure. See [the form pattern](docs/forms.md) for HTTP submission and error handling.

Use Sheet for a mobile menu and DropdownMenu for short action lists. Give Dialog and Sheet an accessible title and description. Pair Checkbox, RadioGroup, Switch, and inputs with visible labels. Reserve tables for tabular data and wrap them in their provided scroll container.

### Design Choices

Set the product's palette, heading/body fonts, and layout before building its screens. Use an explicit user design when supplied; otherwise choose defaults that fit the product.

- Set `--font-body` and `--font-heading` in `src/styles.css`. Use `font-display` for headings when the product needs a separate heading font.
- Use `max-w-content` for a page container and `max-w-reading` for long text. Keep consistent horizontal padding, such as `px-4 sm:px-6`, and a small repeated spacing scale, such as `gap-4`, `gap-6`, and `py-12`.
- Keep one main heading per page and a clear heading order. Use muted text for supporting copy, not essential low-contrast labels.
- Preserve focus rings. Give icon-only buttons an accessible name. Ensure actions work with a keyboard and on narrow screens.
- Use short color/opacity transitions. Add `motion-reduce:transition-none` or `motion-reduce:animate-none` when adding motion; don't make essential content depend on animation.
- Provide loading, empty, error, and success states for each data-driven screen. Skeletons should follow the shape of the content they replace.

### Routing and Server Data

Router types are registered in `src/router.tsx`, so use typed `Link` destinations and route parameters. The root route supplies the themed 404 page; the router's default error component supplies the safe retry/home page, including child-route SSR failures. Use `throw notFound()` for absent records; keep unexpected failures on the error path. See [routing conventions](src/routes/README.md).

Start with route loaders and server functions for server data. Validate server-function input with `.validator(...)`, keep secrets on the server, and handle HTTP failures before returning data. See [the data-fetching pattern](docs/data-fetching.md). Add TanStack Query only when client-side caching, mutations, or background refresh are needed.

### Browser Storage

Pages are rendered on the server first, where `window` and `localStorage` don't exist. Read `localStorage` inside `useEffect`, not during render or in a `useState` initializer, or the first render will differ from the server HTML and React will log a hydration error.

## Configuration Files

| File             | Purpose                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `vite.config.ts` | Vite path aliases and Tailwind, Netlify, TanStack Start, React plugins                           |
| `tsconfig.json`  | Strict TypeScript, with the `@/*` alias for `src/*`                                              |
| `netlify.toml`   | Builds with `vite build`, publishes `dist/client`, dev server on port 8888 proxying Vite on 3000 |

## Development Commands

Use Node 22.13+ on the Node 22 line, Node 24, or Node 26+. The installed lint and test tools set this minimum alongside the framework.

```bash
npm run dev        # Start the Vite dev server on port 3000
npm run build      # Production build
npm run typecheck  # Type-check with tsc; the build doesn't
npm run lint       # Check TypeScript and React Hooks rules
npm run format:check # Check formatting
npm run format     # Format project files
npm test           # Run local form, control, and error page tests
npm run preview    # Preview the production build
```

## Conventions

- Components: PascalCase. Utilities and hooks: camelCase. Route files: kebab-case.
- Import from `src` with the `@/` alias.
- TypeScript fails on unused locals and parameters, so remove what you don't use.
- Use React hooks for state.
- Run the dev server or build once to generate route types before type-checking a fresh copy.
- Run build, typecheck, lint, format:check, and tests before reporting completion. Verify changed user flows locally; a passing build doesn't prove an interaction works.

## Application Name

Set the product's name and description in `src/routes/__root.tsx`:

- `siteName` is the page title and the title shown when the link is shared.
- `siteDescription` is the meta description and the description shown when the link is shared.
