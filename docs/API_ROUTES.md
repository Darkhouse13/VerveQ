# VerveQ API Routes

All endpoints registered in `backend/main.py`. Base URL: `http://{host}:{port}`

## Health (`backend/routes/health.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/health/` | `health_check` | No | No | Basic health check for PM2/load balancers |
| GET | `/health/detailed` | `detailed_health_check` | No | No | Full health check (DB, Redis, system resources) |
| GET | `/health/ready` | `readiness_check` | No | No | Kubernetes-style readiness probe |
| GET | `/health/live` | `liveness_check` | No | No | Kubernetes-style liveness probe |
| GET | `/health/metrics` | `metrics_endpoint` | No | No | Prometheus-style metrics (CPU, memory, threads) |

## Root / Simple (`backend/routes/simple.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/` | `root` | No | No | API info and available sports |
| GET | `/health` | `health_check` | No | No | Sport factory + DB health check |
| POST | `/api/guest-session` | `create_guest_session` | No | No | Create anonymous guest session |
| GET | `/debug/cors` | `debug_cors` | No | No | CORS debug info (dev only) |
| POST | `/session` | `create_session` | No | No | Create a game session |
| GET | `/session/{session_id}/dashboard` | `get_session_dashboard` | No | No | Session dashboard data |
| POST | `/session/{session_id}/score` | `update_session_score` | No | 20/min | Submit score for a session |

## Authentication (`backend/routes/auth.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| POST | `/auth/login` | `login` | No | 10/min | Login or create user account |
| POST | `/auth/guest-session` | `create_guest_session` | No | No | Create guest session |
| GET | `/auth/me` | `get_current_user_info` | JWT | No | Get current user info |

## Quiz (`backend/routes/quiz.py`)

Sports: `football`, `tennis`, `basketball`, `soccer`, `baseball`, `hockey`

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| POST | `/{sport}/quiz/session` | `create_quiz_session` | No | No | Create quiz session (query: `limit`) |
| GET | `/{sport}/quiz/question` | `get_quiz_question` | No | No | Get random question (query: `session_id`, `difficulty`) |
| DELETE | `/{sport}/quiz/session/{session_id}` | `end_quiz_session` | No | No | End quiz session |
| POST | `/{sport}/quiz/check` | `check_quiz_answer` | No | 20/min | Check answer with time-based scoring |
| POST | `/{sport}/quiz/feedback` | `submit_difficulty_feedback` | No | 30/min | Submit difficulty feedback |

## Survival - Session-based (`backend/routes/survival/session.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| POST | `/survival/start` | `start_survival_game` | No | No | Start new survival game |
| POST | `/survival/guess` | `submit_survival_guess` | No | 30/min | Submit a guess |
| GET | `/survival/session/{session_id}` | `get_session_status` | No | No | Get session status |
| POST | `/survival/session/{session_id}/hint` | `get_session_hint` | No | No | Use hint (one per game) |
| POST | `/survival/session/{session_id}/skip` | `skip_challenge` | No | No | Skip challenge (costs a life) |
| DELETE | `/survival/session/{session_id}` | `end_survival_game` | No | No | End survival session |

## Survival - Legacy (`backend/routes/survival/legacy.py`)

Backward-compatible endpoints for older clients.

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/{sport}/survival/initials` | `get_survival_initials_legacy` | No | No | Get random initials challenge |
| POST | `/{sport}/survival/guess` | `submit_survival_guess_legacy` | No | 30/min | Submit guess for initials |
| GET | `/{sport}/survival/reveal/` | `reveal_survival_hints_empty` | No | No | Error: no initials provided |
| GET | `/{sport}/survival/reveal/{initials}` | `reveal_survival_hints_legacy` | No | No | Get hint players for initials |

## Sports (`backend/routes/sports.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/sports` | `get_available_sports` | No | No | List available sports |
| GET | `/sports/{sport}/theme` | `get_sport_theme` | No | No | Get sport theme config |

## Leaderboards (`backend/routes/leaderboards.py`)

Query params: `period` (daily/weekly/monthly/all_time), `limit` (1-100)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/leaderboards/global` | `get_global_leaderboard` | No | 30/min | Global leaderboard |
| GET | `/leaderboards/{sport}/{game_mode}` | `get_sport_leaderboard` | No | 30/min | Sport-specific leaderboard |

## Profile (`backend/routes/profile.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/profile/{user_id}` | `get_user_profile` | No | No | Get user profile |

## Challenges (`backend/routes/challenges.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/challenges/pending` | `get_pending_challenges` | No | No | List pending challenges |
| POST | `/challenges/create` | `create_challenge` | No | No | Create a challenge |
| POST | `/challenges/accept/{challenge_id}` | `accept_challenge` | No | No | Accept a challenge |
| POST | `/challenges/decline/{challenge_id}` | `decline_challenge` | No | No | Decline a challenge |
| GET | `/challenges/{challenge_id}/status` | `get_challenge_status` | No | No | Get challenge status |

## Achievements (`backend/routes/achievements.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/achievements/` | `list_achievements` | No | No | List all achievements |
| GET | `/achievements/user/{user_id}` | `get_user_achievements` | No | No | Get user's unlocked achievements |
| POST | `/achievements/check/{user_id}` | `check_achievements` | No | No | Check and unlock new achievements |

## Games (`backend/routes/games.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| POST | `/{sport}/quiz/complete` | `complete_quiz_game` | No | No | Submit quiz result, update ELO |
| POST | `/{sport}/survival/complete` | `complete_survival_game` | No | No | Submit survival result, update ELO |

## Clerk (`backend/routes/clerk_demo.py`)

| Method | Path | Handler | Auth | Rate Limit | Description |
|--------|------|---------|------|------------|-------------|
| GET | `/clerk/me` | `clerk_me` | Clerk | No | Get current Clerk user context |

---

**Total endpoints: 43**
