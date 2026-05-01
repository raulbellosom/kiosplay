const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../db');
const config = require('../config');
const { deleteFileIfUnreferenced } = require('../mediaFiles');

const UPLOAD_DIR = config.paths.uploadDir;
const MAX_FILE_SIZE_MB = config.maxFileSizeMb;

const ALLOWED_MIME = {
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/png': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/ogg': 'video',
  'video/quicktime': 'video',
};

// Sanitizar nombre de archivo
function sanitizeFilename(name) {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .substring(0, 100);
}

// Storage dinámico según el kiosko
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
    if (!kiosk) return cb(new Error('Kiosko no encontrado'));

    const dir = path.join(UPLOAD_DIR, kiosk.slug);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = sanitizeFilename(path.basename(file.originalname, ext));
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
    cb(null, `${base}-${unique}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}`));
    }
  },
});

// POST /api/kiosks/:id/items/upload
router.post('/:id/items/upload', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  upload.array('files', 20)(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se recibieron archivos' });
    }

    // Obtener el mayor sortOrder actual
    const maxOrder = db.prepare(
      'SELECT MAX(sortOrder) as m FROM kiosk_items WHERE kioskId = ?'
    ).get(req.params.id);
    let nextOrder = (maxOrder?.m ?? -1) + 1;

    const insertedItems = [];
    const insertStmt = db.prepare(`
      INSERT INTO kiosk_items (kioskId, type, filename, originalName, filePath, mimeType, size, sortOrder)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const file of req.files) {
      const type = ALLOWED_MIME[file.mimetype];
      // Guardar path relativo a UPLOAD_DIR para portabilidad
      const relPath = `/${kiosk.slug}/${file.filename}`;

      const result = insertStmt.run(
        kiosk.id,
        type,
        file.filename,
        file.originalname,
        relPath,
        file.mimetype,
        file.size,
        nextOrder++
      );

      insertedItems.push(
        db.prepare('SELECT * FROM kiosk_items WHERE id = ?').get(result.lastInsertRowid)
      );
    }

    res.status(201).json(insertedItems);
  });
});

// GET /api/kiosks/:id/media-library
router.get('/:id/media-library', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  const items = db.prepare(`
    SELECT ki.*, k.name as sourceKioskName, k.slug as sourceKioskSlug
    FROM kiosk_items ki
    JOIN kiosks k ON k.id = ki.kioskId
    JOIN (
      SELECT MIN(id) as id
      FROM kiosk_items
      WHERE kioskId != ?
        AND filePath NOT IN (SELECT filePath FROM kiosk_items WHERE kioskId = ?)
      GROUP BY filePath
    ) picked ON picked.id = ki.id
    ORDER BY k.name COLLATE NOCASE ASC, ki.originalName COLLATE NOCASE ASC
  `).all(kiosk.id, kiosk.id);

  res.json(items);
});

// POST /api/kiosks/:id/items/from-existing
router.post('/:id/items/from-existing', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  const itemIds = Array.isArray(req.body?.itemIds)
    ? req.body.itemIds.map(id => parseInt(id, 10)).filter(Number.isInteger)
    : [];

  if (itemIds.length === 0) {
    return res.status(400).json({ error: 'Se requiere itemIds' });
  }

  const placeholders = itemIds.map(() => '?').join(',');
  const sourceItems = db.prepare(`
    SELECT *
    FROM kiosk_items
    WHERE id IN (${placeholders})
      AND kioskId != ?
    ORDER BY id ASC
  `).all(...itemIds, kiosk.id);

  const existingPaths = new Set(
    db.prepare('SELECT filePath FROM kiosk_items WHERE kioskId = ?').all(kiosk.id)
      .map(item => item.filePath),
  );
  const maxOrder = db.prepare(
    'SELECT MAX(sortOrder) as m FROM kiosk_items WHERE kioskId = ?'
  ).get(kiosk.id);
  let nextOrder = (maxOrder?.m ?? -1) + 1;

  const insertStmt = db.prepare(`
    INSERT INTO kiosk_items
      (kioskId, type, filename, originalName, filePath, mimeType, size, durationSeconds, sortOrder, enabled)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
  `);

  const insertMany = db.transaction((items) => {
    const inserted = [];
    const skipped = [];

    for (const item of items) {
      if (existingPaths.has(item.filePath)) {
        skipped.push(item.id);
        continue;
      }

      const result = insertStmt.run(
        kiosk.id,
        item.type,
        item.filename,
        item.originalName,
        item.filePath,
        item.mimeType,
        item.size,
        item.durationSeconds,
        nextOrder++,
      );
      existingPaths.add(item.filePath);
      inserted.push(db.prepare('SELECT * FROM kiosk_items WHERE id = ?').get(result.lastInsertRowid));
    }

    return { inserted, skipped };
  });

  res.status(201).json(insertMany(sourceItems));
});

// PUT /api/items/:id
router.put('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM kiosk_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });

  const { enabled, durationSeconds } = req.body;

  const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : item.enabled;
  const newDuration = durationSeconds !== undefined
    ? Math.max(1, parseInt(durationSeconds, 10) || 5)
    : item.durationSeconds;

  db.prepare(`
    UPDATE kiosk_items
    SET enabled = ?, durationSeconds = ?, updatedAt = datetime('now')
    WHERE id = ?
  `).run(newEnabled, newDuration, req.params.id);

  const updated = db.prepare('SELECT * FROM kiosk_items WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/items/:id
router.delete('/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM kiosk_items WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Item no encontrado' });

  db.prepare('DELETE FROM kiosk_items WHERE id = ?').run(req.params.id);
  deleteFileIfUnreferenced(db, UPLOAD_DIR, item.filePath);
  res.json({ ok: true });
});

module.exports = router;
