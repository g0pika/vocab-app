package main

import (
	"database/sql"
	_ "embed"
	"encoding/json"
	"time"
)

//go:embed seed_words.json
var seedJSON []byte

type seedWord struct {
	Word      string `json:"word"`
	Meaning   string `json:"meaning"`
	Etymology string `json:"etymology"`
	Usage     string `json:"usage"`
	Synonyms  string `json:"synonyms"`
}

func seedWords(db *sql.DB) (int, error) {
	var words []seedWord
	if err := json.Unmarshal(seedJSON, &words); err != nil {
		return 0, err
	}

	tx, err := db.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()

	insertWord, err := tx.Prepare(
		`INSERT OR IGNORE INTO words (word, meaning, etymology, usage, synonyms)
		 VALUES (?, ?, ?, ?, ?)`)
	if err != nil {
		return 0, err
	}
	defer insertWord.Close()

	insertReview, err := tx.Prepare(
		`INSERT OR IGNORE INTO reviews (word_id, step, next_review_date)
		 VALUES ((SELECT id FROM words WHERE word = ?), 0, ?)`)
	if err != nil {
		return 0, err
	}
	defer insertReview.Close()

	today := time.Now().Format("2006-01-02")
	inserted := 0
	for _, w := range words {
		res, err := insertWord.Exec(w.Word, w.Meaning, w.Etymology, w.Usage, w.Synonyms)
		if err != nil {
			return 0, err
		}
		if _, err := insertReview.Exec(w.Word, today); err != nil {
			return 0, err
		}
		if n, _ := res.RowsAffected(); n > 0 {
			inserted++
		}
	}
	return inserted, tx.Commit()
}
