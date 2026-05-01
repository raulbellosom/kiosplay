const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('server config resolves relative persistent paths from the project root', () => {
  const rootDir = path.resolve(__dirname, '..');
  const configPath = path.join(rootDir, 'server', 'config.js');

  const previous = {
    SQLITE_PATH: process.env.SQLITE_PATH,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    TEMP_DIR: process.env.TEMP_DIR,
  };

  process.env.SQLITE_PATH = './data/kiosko.db';
  process.env.UPLOAD_DIR = './uploads';
  process.env.TEMP_DIR = './temp';
  delete require.cache[require.resolve(configPath)];

  try {
    const config = require(configPath);

    assert.equal(config.paths.rootDir, rootDir);
    assert.equal(config.paths.sqlitePath, path.join(rootDir, 'data', 'kiosko.db'));
    assert.equal(config.paths.uploadDir, path.join(rootDir, 'uploads'));
    assert.equal(config.paths.tempDir, path.join(rootDir, 'temp'));
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve(configPath)];
  }
});

test('server config preserves absolute persistent paths', () => {
  const rootDir = path.resolve(__dirname, '..');
  const configPath = path.join(rootDir, 'server', 'config.js');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosko-config-'));
  const dbPath = path.join(tempDir, 'db', 'kiosko.db');
  const uploadsPath = path.join(tempDir, 'uploads');

  const previous = {
    SQLITE_PATH: process.env.SQLITE_PATH,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
    TEMP_DIR: process.env.TEMP_DIR,
  };

  process.env.SQLITE_PATH = dbPath;
  process.env.UPLOAD_DIR = uploadsPath;
  process.env.TEMP_DIR = path.join(tempDir, 'temp');
  delete require.cache[require.resolve(configPath)];

  try {
    const config = require(configPath);

    assert.equal(config.paths.sqlitePath, dbPath);
    assert.equal(config.paths.uploadDir, uploadsPath);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve(configPath)];
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
