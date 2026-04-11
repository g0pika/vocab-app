# Lexicon

A vocabulary builder styled as a daily literary broadsheet. Learn new English words at your own pace (1–5 per day), let spaced repetition bring them back for review, and test yourself with randomised multiple-choice examinations.

Designed as an editorial page — warm paper, Fraunces italic display, vermillion rubrication. No dashboards, no streaks, no dopamine theatre. Just words, patiently.

**Live:** https://g0pika.github.io/vocab-app/

## Features

- **Daily lesson** — a configurable number of new words per day (1–5), picked at random from the corpus
- **Spaced repetition** — each recalled word returns on a quadratic schedule: `(step+1)²` days (1, 4, 9, 16, 25, 36…)
- **Review mode** — flashcards for words whose schedule has come due
- **Examination mode** — multiple-choice quizzes with distractors drawn from the rest of the corpus
- **Almanac** — running stats on what you've seen, what you're learning, and what you've mastered
- **Persistent** — progress stored in your browser's `localStorage`, survives page closes and restarts
- **Offline-friendly** — single static bundle, no backend required for the web version

## Architecture

Two independent implementations share one corpus (`seed_words.json` → `docs/words.json`):

### Static web version (`docs/`)
Pure HTML/CSS/JS. State lives in `localStorage`. This is what's deployed to GitHub Pages. No build step — edit the files and refresh.

### Self-hostable Go backend (`backend/`)
A single-binary Go server with `embed`ded assets and SQLite persistence (`modernc.org/sqlite`, no cgo). Useful if you want multi-device sync via a shared database.

```
backend/
├── main.go          # HTTP server + handlers
├── repetition.go    # spaced-repetition scheduler
├── seed.go          # loads seed_words.json into SQLite
├── init.sql         # schema
├── seed_words.json  # 333 hand-curated words
└── static/          # same HTML/CSS/JS as docs/, but fetches /api/*
```

## Run the Go backend locally

```
cd backend
go build -o vocab .
./vocab
```

Open http://localhost:8080. Environment: `PORT` (default `8080`), `DB_PATH` (default `vocab.db`).

## Deploy the Go backend with Docker

```
cd backend
docker build -t lexicon .
docker run -p 8080:8080 -v $(pwd)/data:/data lexicon
```

A `fly.toml` is included for Fly.io deployment with a mounted volume for SQLite.

## Spaced repetition design

Each review advances the word's step counter; the next review lands in `(step+1)²` days. Both correct and wrong answers advance the step — wrong answers only update the error counter. This ensures no word gets stuck in a loop, while still surfacing difficulty via the examination signal.
