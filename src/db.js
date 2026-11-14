const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const SCHEMA = `
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS players (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE
  );

  CREATE TABLE IF NOT EXISTS events (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL CHECK (type IN ('training', 'match')),
    date       TEXT NOT NULL,
    time       TEXT NOT NULL,
    location   TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS attendance (
    event_id   INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    player_id  INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    status     TEXT NOT NULL CHECK (status IN ('yes', 'no')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (event_id, player_id)
  );
`;

function openDb(file = ':memory:') {
  if (file !== ':memory:') {
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

module.exports = { openDb };
