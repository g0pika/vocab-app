package main

import (
	_ "embed"

	"database/sql"

	_ "modernc.org/sqlite"
)

//go:embed init.sql
var initSQL string

func openDB(path string) (*sql.DB, error) {
	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, err
	}
	if _, err := db.Exec("PRAGMA foreign_keys = ON"); err != nil {
		return nil, err
	}
	if _, err := db.Exec(initSQL); err != nil {
		return nil, err
	}
	return db, nil
}
