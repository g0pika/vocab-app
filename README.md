# Lexicon

A vocabulary builder styled as a daily literary broadsheet. Learn new English words at your own pace (1–5 per day), let spaced repetition bring them back for review, and test yourself with randomised multiple-choice examinations.

Designed as an editorial page — warm paper, Fraunces italic display, vermillion rubrication. No dashboards, no streaks, no dopamine theatre. Just words, patiently.

## Features

- **Daily lesson** — a configurable number of new words per day, picked at random from the corpus
- **Spaced repetition** — each recalled word returns on a quadratic schedule (1, 4, 9, 16, 25… days)
- **Review mode** — flashcards for words that are due
- **Examination mode** — multiple-choice quizzes with distractors drawn from the rest of the corpus
- **Almanac** — running stats on what you've seen, what you're learning, and what you've mastered
- **Persistent** — progress saved locally in SQLite, survives browser closes and restarts

## Stack

- **Go** (stdlib `net/http`, `embed`, `modernc.org/sqlite`) — single binary, no cgo
- **SQLite** — one file, persistent progress
- **Vanilla HTML/CSS/JS** — no build step, assets embedded into the Go binary
- **Hand-curated word corpus** seeded from `seed_words.json`

## Run locally

```
cd backend
go build -o vocab .
./vocab
```

Open http://localhost:8080.

### Environment

- `PORT` (default `8080`)
- `DB_PATH` (default `vocab.db`)

## Spaced repetition

Each review advances a word's step counter; the next review lands in `(step+1)²` days. Both right and wrong answers advance the step — wrong answers only update the error counter and examination signal, so you don't get stuck on a word forever.
