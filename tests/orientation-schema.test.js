const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('kiosks table includes portrait orientation and cover fit mode by default', () => {
  const rootDir = path.resolve(__dirname, '..');
  const dbModulePath = path.join(rootDir, 'server', 'db.js');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosko-db-'));
  const dbPath = path.join(tempDir, 'kiosko.db');
  const previousSqlitePath = process.env.SQLITE_PATH;

  process.env.SQLITE_PATH = dbPath;
  delete require.cache[require.resolve(dbModulePath)];
  let db;

  try {
    db = require(dbModulePath);
    const columns = db.prepare('PRAGMA table_info(kiosks)').all();
    const orientation = columns.find(column => column.name === 'orientation');
    const fitMode = columns.find(column => column.name === 'fitMode');

    assert.ok(orientation, 'orientation column should exist on kiosks');
    assert.equal(orientation.type, 'TEXT');
    assert.equal(orientation.notnull, 1);
    assert.equal(String(orientation.dflt_value).replace(/'/g, ''), 'portrait');
    assert.ok(fitMode, 'fitMode column should exist on kiosks');
    assert.equal(fitMode.type, 'TEXT');
    assert.equal(fitMode.notnull, 1);
    assert.equal(String(fitMode.dflt_value).replace(/'/g, ''), 'cover');

    const result = db.prepare(
      'INSERT INTO kiosks (name, slug) VALUES (?, ?)',
    ).run('Recepcion', 'recepcion');
    const kiosk = db.prepare('SELECT orientation, fitMode FROM kiosks WHERE id = ?').get(result.lastInsertRowid);

    assert.equal(kiosk.orientation, 'portrait');
    assert.equal(kiosk.fitMode, 'cover');
  } finally {
    if (db?.open) db.close();
    if (previousSqlitePath === undefined) delete process.env.SQLITE_PATH;
    else process.env.SQLITE_PATH = previousSqlitePath;
    delete require.cache[require.resolve(dbModulePath)];
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
