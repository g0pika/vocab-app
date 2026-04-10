package main

import (
	"database/sql"
	"time"
)

// intervalDays returns (step+1)^2 for the quadratic schedule:
// step 0 -> 1 day, step 1 -> 4, step 2 -> 9, step 3 -> 16, ...
func intervalDays(step int) int {
	n := step + 1
	return n * n
}

const masteredStep = 7 // 8^2 = 64 day interval when step becomes 8

// advanceReview applies the quadratic scheduler. The step ALWAYS advances,
// whether the answer was correct or wrong (per user requirement). Wrong
// answers only update the counters and last_wrong_date for exam-mode signal.
// Idempotent: if already reviewed today, this is a no-op.
func advanceReview(db *sql.DB, wordID int64, correct bool, today time.Time) error {
	var step int
	var lastReviewed sql.NullString
	err := db.QueryRow(
		`SELECT step, last_reviewed FROM reviews WHERE word_id = ?`,
		wordID,
	).Scan(&step, &lastReviewed)
	if err != nil {
		return err
	}

	todayStr := today.Format("2006-01-02")
	if lastReviewed.Valid && lastReviewed.String == todayStr {
		return nil // already advanced today
	}

	newStep := step + 1
	nextDate := today.AddDate(0, 0, intervalDays(newStep)).Format("2006-01-02")

	if correct {
		_, err = db.Exec(`
			UPDATE reviews
			   SET step = ?, next_review_date = ?, last_reviewed = ?,
			       review_correct = review_correct + 1
			 WHERE word_id = ?`,
			newStep, nextDate, todayStr, wordID)
	} else {
		_, err = db.Exec(`
			UPDATE reviews
			   SET step = ?, next_review_date = ?, last_reviewed = ?,
			       review_wrong = review_wrong + 1, last_wrong_date = ?
			 WHERE word_id = ?`,
			newStep, nextDate, todayStr, todayStr, wordID)
	}
	return err
}

// recordExamAnswer updates exam counters only — never touches the
// spaced-repetition schedule.
func recordExamAnswer(db *sql.DB, wordID int64, correct bool, today time.Time) error {
	todayStr := today.Format("2006-01-02")
	var err error
	if correct {
		_, err = db.Exec(
			`UPDATE reviews SET exam_correct = exam_correct + 1 WHERE word_id = ?`,
			wordID)
	} else {
		_, err = db.Exec(
			`UPDATE reviews SET exam_wrong = exam_wrong + 1, last_wrong_date = ? WHERE word_id = ?`,
			todayStr, wordID)
	}
	return err
}

// resolveToday returns the current date in the given IANA timezone, falling
// back to local time if the zone is empty or unrecognised.
func resolveToday(tz string) time.Time {
	if tz == "" {
		return time.Now()
	}
	loc, err := time.LoadLocation(tz)
	if err != nil {
		return time.Now()
	}
	return time.Now().In(loc)
}
