# VerveQ — Competitive Sports Trivia Platform

A competitive sports trivia platform where players test their knowledge through multiple game modes, earn ELO ratings, climb leaderboards, unlock achievements, and challenge friends. Features image-based questions with stadium photos, team badges, and player silhouettes.

## Features

### Game Modes
- **Quiz Mode** — 10-question timed multiple-choice trivia with 3 difficulty levels (Easy, Intermediate, Hard). Mixes text and image-based questions (max 3 image questions per session, never consecutive).
- **Survival Mode** — Guess player names from initials. 3 lives, progressive difficulty, fuzzy matching, hint system.
- **Blitz Mode** — 60-second rapid-fire quiz. Answer as many as possible before time runs out. Wrong answers cost 3 seconds.
- **Daily Challenge** — A fresh set of 10 questions every day, same for all players per sport. Complete for daily leaderboard rankings.
- **The Forge** — Community question creation. Submit new questions, vote on submissions, and earn contributor badges.
- **Live Match** — Head-to-head multiplayer trivia with ELO-based matchmaking.

### Image-Based Questions
- **Stadium Identification** — Identify stadiums from photos (228 questions across 13 leagues)
- **Team Badge Recognition** — Match badges to team names (268 questions, always easy difficulty)
- **Player Silhouettes** — Identify players from transparent cutout images (2,018 questions)
- Images sourced from TheSportsDB and stored in Convex storage
- Smart question mixing: max 3 image questions per session, spread evenly

### Competitive System
- **ELO Ratings** — Per sport/mode skill tracking with adaptive K-factor (placement: K=40, standard: K=32, high-tier: K=16)
- **Leaderboards** — Global and daily rankings filtered by sport, mode, and time period
- **Tier System** — Bronze, Silver, Gold, Platinum based on ELO
- **Seasons** — Periodic ranking resets with season history tracking
- **ELO Decay** — Inactive players gradually lose rating to keep leaderboards competitive
- **Achievements** — Unlockable badges with point rewards

### Sports
- Football (30,913 survival players, 970+ quiz questions, 2,000+ image questions)
- Basketball (3,608 survival players, 285+ quiz questions, 400+ image questions)
- Tennis (1,156 survival players, 274 quiz questions)

### Social
- Player-vs-player challenges and live matches
- Shareable profiles with stats and game history

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | [Convex](https://convex.dev) (serverless TypeScript) |
| Auth | @convex-dev/auth (Anonymous + Password) |
| Styling | Tailwind CSS + shadcn/ui |
| Design | Neo-brutalism (thick borders, bold shadows) |
| Image Storage | Convex Storage (2,514 images) |

## Quick Start

```bash
# Install dependencies
cd frontend-web
npm install

# Start Convex backend + dev server
npx convex dev   # Terminal 1 (backend)
npx vite         # Terminal 2 (frontend on port 5173)
```

### First-time Convex setup
```bash
cd frontend-web
npx convex dev          # Creates deployment, pushes schema
npx @convex-dev/auth    # Configures JWT keys
```

### Seed data
```bash
# Seed achievements (run once in Convex dashboard)
# Call: seedAchievements.seed()

# Seed quiz questions from SQLite
cd frontend-web
npm install better-sqlite3
node scripts/seed-questions.mjs

# Generate and seed image-based questions (optional, ~50 min total)
node ../scripts/generate_image_dataset.js   # Generates complete_image_seed_data.json
node scripts/seed-image-questions.mjs       # Uploads images to Convex storage

# Run one-time data migrations (via Convex dashboard)
# seedQuestions:fixBadgeDifficulty         — sets badge questions to "easy"
# seedQuestions:clearImageExplanations     — removes auto-generated explanations
```

## Project Structure

```
frontend-web/
├── convex/                  # Convex backend
│   ├── schema.ts           # Database schema
│   ├── auth.ts             # Auth providers
│   ├── quizSessions.ts     # Quiz game logic (image cap + spacing)
│   ├── survivalSessions.ts # Survival game logic
│   ├── blitz.ts            # Blitz mode (60s timed)
│   ├── dailyChallenge.ts   # Daily challenge system
│   ├── forge.ts            # Community question forge
│   ├── liveMatches.ts      # Head-to-head multiplayer
│   ├── games.ts            # Game completion + ELO
│   ├── leaderboards.ts     # Rankings
│   ├── dailyLeaderboard.ts # Daily rankings
│   ├── achievements.ts     # Achievement system
│   ├── challenges.ts       # PvP challenges
│   ├── profile.ts          # Player stats
│   ├── seedQuestions.ts     # Seeding + image upload pipeline
│   ├── storage.ts          # Convex file storage
│   ├── seasonManager.ts    # Season lifecycle
│   ├── eloDecay.ts         # Rating decay for inactive players
│   ├── crons.ts            # Scheduled jobs
│   ├── lib/                # Shared logic
│   │   ├── elo.ts          # ELO calculations
│   │   ├── scoring.ts      # Time-based scoring
│   │   ├── daily.ts        # Daily challenge helpers
│   │   └── fuzzy.ts        # Jaro-Winkler matching
│   └── data/               # Bundled game data
├── src/
│   ├── pages/              # Game screens (Quiz, Blitz, Daily, Forge, Live Match, etc.)
│   ├── components/         # UI components (QuestionImage, BlitzClock, ImageZoomModal, etc.)
│   ├── hooks/              # Custom hooks (useCountdown, useAntiCheat)
│   └── contexts/           # Auth context
├── scripts/
│   ├── seed-questions.mjs       # Seed text questions from SQLite
│   └── seed-image-questions.mjs # Seed image questions to Convex storage
└── package.json

scripts/
├── generate_image_dataset.js     # Fetch images from TheSportsDB API
└── generate_football_metadata.js # Player metadata for hint system
```

## Documentation

- [App Overview](docs/APP_OVERVIEW.md) — Comprehensive feature documentation
- [Convex Migration Plan](docs/CONVEX_MIGRATION_PLAN.md) — Migration from FastAPI to Convex
- [API Routes](docs/API_ROUTES.md) — Backend endpoint reference
- [Contributing](docs/CONTRIBUTING.md) — Development guidelines
- [Security](docs/SECURITY.md) — Security policy

## License

See [LICENSE](LICENSE) for details.
