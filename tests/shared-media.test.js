const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

test('shared media files are only removed after the last playlist reference is deleted', () => {
  const rootDir = path.resolve(__dirname, '..');
  const dbModulePath = path.join(rootDir, 'server', 'db.js');
  const mediaFilesPath = path.join(rootDir, 'server', 'mediaFiles.js');
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kiosko-shared-media-'));
  const dbPath = path.join(tempDir, 'kiosko.db');
  const uploadDir = path.join(tempDir, 'uploads');
  const sharedPath = '/source/shared.jpg';
  const absoluteFile = path.join(uploadDir, 'source', 'shared.jpg');
  const previous = {
    SQLITE_PATH: process.env.SQLITE_PATH,
    UPLOAD_DIR: process.env.UPLOAD_DIR,
  };

  process.env.SQLITE_PATH = dbPath;
  process.env.UPLOAD_DIR = uploadDir;
  delete require.cache[require.resolve(dbModulePath)];
  delete require.cache[require.resolve(mediaFilesPath)];
  let db;

  try {
    db = require(dbModulePath);
    const { deleteFileIfUnreferenced } = require(mediaFilesPath);

    fs.mkdirSync(path.dirname(absoluteFile), { recursive: true });
    fs.writeFileSync(absoluteFile, 'image bytes');

    const insertKiosk = db.prepare('INSERT INTO kiosks (name, slug) VALUES (?, ?)');
    const source = insertKiosk.run('Source', 'source').lastInsertRowid;
    const target = insertKiosk.run('Target', 'target').lastInsertRowid;
    const insertItem = db.prepare(`
      INSERT INTO kiosk_items
        (kioskId, type, filename, originalName, filePath, mimeType, size, sortOrder)
      VALUES (?, 'image', 'shared.jpg', 'shared.jpg', ?, 'image/jpeg', 11, 0)
    `);
    const sourceItem = insertItem.run(source, sharedPath).lastInsertRowid;
    const targetItem = insertItem.run(target, sharedPath).lastInsertRowid;

    db.prepare('DELETE FROM kiosk_items WHERE id = ?').run(sourceItem);
    deleteFileIfUnreferenced(db, uploadDir, sharedPath);
    assert.equal(fs.existsSync(absoluteFile), true);

    db.prepare('DELETE FROM kiosk_items WHERE id = ?').run(targetItem);
    deleteFileIfUnreferenced(db, uploadDir, sharedPath);
    assert.equal(fs.existsSync(absoluteFile), false);
  } finally {
    if (db?.open) db.close();
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    delete require.cache[require.resolve(dbModulePath)];
    try { delete require.cache[require.resolve(mediaFilesPath)]; } catch {}
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
});
