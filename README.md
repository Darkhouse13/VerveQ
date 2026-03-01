# VerveQ — Competitive Sports Trivia Platform

A competitive sports trivia platform where players test their knowledge through Quiz and Survival modes, earn ELO ratings, climb leaderboards, unlock achievements, and challenge friends.

## Features

### Game Modes
- **Quiz Mode** — 10-question timed multiple-choice trivia with 3 difficulty levels (Easy, Medium, Hard)
- **Survival Mode** — Guess player names from initials. 3 lives, progressive difficulty, fuzzy matching, hint system

### Competitive System
- **ELO Ratings** — Per sport/mode skill tracking (K=32, range 800-2400)
- **Leaderboards** — Global rankings filtered by sport, mode, and time period
- **Tier System** — Bronze, Silver, Gold, Platinum based on ELO
- **Achievements** — 7 unlockable badges with point rewards

### Sports
- Football (30,913 survival players, 301 quiz questions)
- Basketball (3,608 survival players, 285 quiz questions)
- Tennis (1,156 survival players, 274 quiz questions)

### Social
- Player-vs-player challenges
- Shareable profiles with stats and game history

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + TypeScript + Vite |
| Backend | [Convex](https://convex.dev) (serverless TypeScript) |
| Auth | @convex-dev/auth (Anonymous + Password) |
| Styling | Tailwind CSS + shadcn/ui |
| Design | Neo-brutalism (thick borders, bold shadows) |

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

# Seed 860 quiz questions from SQLite
npm install better-sqlite3
node scripts/seed-questions.mjs
```

## Project Structure

```
frontend-web/
├── convex/                  # Convex backend
│   ├── schema.ts           # Database schema (9 tables)
│   ├── auth.ts             # Auth providers
│   ├── quizSessions.ts     # Quiz game logic
│   ├── survivalSessions.ts # Survival game logic
│   ├── games.ts            # Game completion + ELO
│   ├── leaderboards.ts     # Rankings
│   ├── achievements.ts     # Achievement system
│   ├── challenges.ts       # PvP challenges
│   ├── profile.ts          # Player stats
│   ├── sports.ts           # Sports config
│   ├── lib/                # Shared logic
│   │   ├── elo.ts          # ELO calculations
│   │   ├── scoring.ts      # Time-based scoring
│   │   └── fuzzy.ts        # Jaro-Winkler matching
│   └── data/               # Bundled game data
│       ├── survival_initials_map.json
│       ├── survival_initials_map_tennis.json
│       └── nba_survival_data.json
├── src/
│   ├── pages/              # 12 screens
│   ├── components/neo/     # Neo-brutalist UI components
│   ├── contexts/           # Auth context
│   └── hooks/              # Custom hooks
└── package.json
```

## Documentation

- [App Overview](docs/APP_OVERVIEW.md) — Comprehensive feature documentation
- [Convex Migration Plan](docs/CONVEX_MIGRATION_PLAN.md) — Migration from FastAPI to Convex
- [API Routes](docs/API_ROUTES.md) — Backend endpoint reference
- [Contributing](docs/CONTRIBUTING.md) — Development guidelines
- [Security](docs/SECURITY.md) — Security policy

## License

See [LICENSE](LICENSE) for details.
