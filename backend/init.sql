CREATE TABLE IF NOT EXISTS words (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  word       TEXT UNIQUE NOT NULL,
  meaning    TEXT NOT NULL,
  etymology  TEXT,
  usage      TEXT,
  synonyms   TEXT,
  added_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews (
  word_id          INTEGER PRIMARY KEY REFERENCES words(id) ON DELETE CASCADE,
  step             INTEGER NOT NULL DEFAULT 0,
  next_review_date DATE NOT NULL,
  first_seen_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_reviewed    DATE,
  review_correct   INTEGER NOT NULL DEFAULT 0,
  review_wrong     INTEGER NOT NULL DEFAULT 0,
  last_wrong_date  DATE,
  exam_correct     INTEGER NOT NULL DEFAULT 0,
  exam_wrong       INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_reviews_due ON reviews(next_review_date);
