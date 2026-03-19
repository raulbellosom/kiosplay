const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.SQLITE_PATH || './data/kiosko.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// WAL mode para mejor concurrencia
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS kiosks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS kiosk_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kioskId INTEGER NOT NULL REFERENCES kiosks(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('image', 'video')),
    filename TEXT NOT NULL,
    originalName TEXT NOT NULL,
    filePath TEXT NOT NULL,
    mimeType TEXT NOT NULL,
    size INTEGER NOT NULL,
    durationSeconds INTEGER NOT NULL DEFAULT 5,
    sortOrder INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (datetime('now')),
    updatedAt TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

module.exports = db;
