const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const dbPath = config.paths.sqlitePath;
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
    orientation TEXT NOT NULL DEFAULT 'portrait' CHECK(orientation IN ('portrait', 'landscape')),
    fitMode TEXT NOT NULL DEFAULT 'cover' CHECK(fitMode IN ('cover', 'contain')),
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

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(c => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

ensureColumn(
  'kiosks',
  'orientation',
  "TEXT NOT NULL DEFAULT 'portrait' CHECK(orientation IN ('portrait', 'landscape'))",
);

ensureColumn(
  'kiosks',
  'fitMode',
  "TEXT NOT NULL DEFAULT 'cover' CHECK(fitMode IN ('cover', 'contain'))",
);

module.exports = db;
