package main

import (
	"database/sql"
	"embed"
	"encoding/json"
	"io/fs"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strconv"
	"time"
)

//go:embed all:static
var staticFS embed.FS

type Word struct {
	ID        int64  `json:"id"`
	Word      string `json:"word"`
	Meaning   string `json:"meaning"`
	Etymology string `json:"etymology"`
	Usage     string `json:"usage"`
	Synonyms  string `json:"synonyms"`
}

type NextResponse struct {
	TodayDone int   `json:"today_done"`
	Limit     int   `json:"limit"`
	Word      *Word `json:"word"`
}

type QuizResponse struct {
	Word    Word     `json:"word"`
	Options []string `json:"options"`
	Answer  int      `json:"answer"`
}

type reviewRequest struct {
	WordID  int64 `json:"word_id"`
	Correct bool  `json:"correct"`
}

type Stats struct {
	Total         int `json:"total"`
	New           int `json:"new"`
	Learning      int `json:"learning"`
	Mastered      int `json:"mastered"`
	DueToday      int `json:"due_today"`
	ReviewCorrect int `json:"review_correct"`
	ReviewWrong   int `json:"review_wrong"`
	ExamCorrect   int `json:"exam_correct"`
	ExamWrong     int `json:"exam_wrong"`
}

func main() {
	dbPath := os.Getenv("DB_PATH")
	if dbPath == "" {
		dbPath = "vocab.db"
	}
	db, err := openDB(dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	n, err := seedWords(db)
	if err != nil {
		log.Fatal(err)
	}
	log.Printf("seeded %d new words", n)

	mux := http.NewServeMux()
	mux.HandleFunc("/api/next", handleNext(db))
	mux.HandleFunc("/api/due", handleDue(db))
	mux.HandleFunc("/api/quiz", handleQuiz(db))
	mux.HandleFunc("/api/review", handleReview(db))
	mux.HandleFunc("/api/exam", handleExam(db))
	mux.HandleFunc("/api/stats", handleStats(db))

	sub, err := fs.Sub(staticFS, "static")
	if err != nil {
		log.Fatal(err)
	}
	mux.Handle("/", http.FileServer(http.FS(sub)))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, mux))
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func handleNext(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		limit := 3
		if q := r.URL.Query().Get("limit"); q != "" {
			if n, err := strconv.Atoi(q); err == nil && n >= 1 && n <= 5 {
				limit = n
			}
		}
		today := time.Now().Format("2006-01-02")
		var doneToday int
		db.QueryRow(`SELECT COUNT(*) FROM reviews WHERE step = 1 AND last_reviewed = ?`, today).Scan(&doneToday)
		if doneToday >= limit {
			writeJSON(w, 200, NextResponse{TodayDone: doneToday, Limit: limit, Word: nil})
			return
		}
		var word Word
		err := db.QueryRow(`
			SELECT w.id, w.word, w.meaning, w.etymology, w.usage, w.synonyms
			FROM words w JOIN reviews r ON r.word_id = w.id
			WHERE r.step = 0 AND r.last_reviewed IS NULL
			ORDER BY RANDOM() LIMIT 1
		`).Scan(&word.ID, &word.Word, &word.Meaning, &word.Etymology, &word.Usage, &word.Synonyms)
		if err == sql.ErrNoRows {
			writeJSON(w, 200, NextResponse{TodayDone: doneToday, Limit: limit, Word: nil})
			return
		}
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, NextResponse{TodayDone: doneToday, Limit: limit, Word: &word})
	}
}

func handleDue(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		today := time.Now().Format("2006-01-02")
		var word Word
		err := db.QueryRow(`
			SELECT w.id, w.word, w.meaning, w.etymology, w.usage, w.synonyms
			FROM words w JOIN reviews r ON r.word_id = w.id
			WHERE r.last_reviewed IS NOT NULL
			  AND r.next_review_date <= ?
			  AND r.last_reviewed != ?
			ORDER BY r.next_review_date LIMIT 1
		`, today, today).Scan(&word.ID, &word.Word, &word.Meaning, &word.Etymology, &word.Usage, &word.Synonyms)
		if err == sql.ErrNoRows {
			writeJSON(w, 404, map[string]string{"error": "no words due"})
			return
		}
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, word)
	}
}

func handleQuiz(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var word Word
		err := db.QueryRow(`
			SELECT w.id, w.word, w.meaning, w.etymology, w.usage, w.synonyms
			FROM words w JOIN reviews r ON r.word_id = w.id
			WHERE r.step > 0
			ORDER BY RANDOM() LIMIT 1
		`).Scan(&word.ID, &word.Word, &word.Meaning, &word.Etymology, &word.Usage, &word.Synonyms)
		if err == sql.ErrNoRows {
			writeJSON(w, 404, map[string]string{"error": "learn a few words first"})
			return
		}
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}

		rows, err := db.Query(`SELECT meaning FROM words WHERE id != ? ORDER BY RANDOM() LIMIT 3`, word.ID)
		if err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		defer rows.Close()
		options := []string{word.Meaning}
		for rows.Next() {
			var m string
			rows.Scan(&m)
			options = append(options, m)
		}
		rand.Shuffle(len(options), func(i, j int) { options[i], options[j] = options[j], options[i] })
		answer := 0
		for i, o := range options {
			if o == word.Meaning {
				answer = i
				break
			}
		}
		writeJSON(w, 200, QuizResponse{Word: word, Options: options, Answer: answer})
	}
}

func handleReview(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		var req reviewRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, 400, map[string]string{"error": err.Error()})
			return
		}
		if err := advanceReview(db, req.WordID, req.Correct, time.Now()); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	}
}

func handleExam(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			writeJSON(w, 405, map[string]string{"error": "method not allowed"})
			return
		}
		var req reviewRequest
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			writeJSON(w, 400, map[string]string{"error": err.Error()})
			return
		}
		if err := recordExamAnswer(db, req.WordID, req.Correct, time.Now()); err != nil {
			writeJSON(w, 500, map[string]string{"error": err.Error()})
			return
		}
		writeJSON(w, 200, map[string]bool{"ok": true})
	}
}

func handleStats(db *sql.DB) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		today := time.Now().Format("2006-01-02")
		var s Stats
		db.QueryRow(`SELECT COUNT(*) FROM words`).Scan(&s.Total)
		db.QueryRow(`SELECT COUNT(*) FROM reviews WHERE step = 0 AND last_reviewed IS NULL`).Scan(&s.New)
		db.QueryRow(`SELECT COUNT(*) FROM reviews WHERE step > 0 AND step < 8`).Scan(&s.Learning)
		db.QueryRow(`SELECT COUNT(*) FROM reviews WHERE step >= 8`).Scan(&s.Mastered)
		db.QueryRow(`SELECT COUNT(*) FROM reviews WHERE last_reviewed IS NOT NULL AND next_review_date <= ? AND last_reviewed != ?`, today, today).Scan(&s.DueToday)
		db.QueryRow(`SELECT COALESCE(SUM(review_correct),0), COALESCE(SUM(review_wrong),0), COALESCE(SUM(exam_correct),0), COALESCE(SUM(exam_wrong),0) FROM reviews`).
			Scan(&s.ReviewCorrect, &s.ReviewWrong, &s.ExamCorrect, &s.ExamWrong)
		writeJSON(w, 200, s)
	}
}
