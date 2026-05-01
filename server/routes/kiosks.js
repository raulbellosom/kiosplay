const express = require('express');
const router = express.Router();
const db = require('../db');
const slugify = require('slugify');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const { deleteUnreferencedFiles } = require('../mediaFiles');

const UPLOAD_DIR = config.paths.uploadDir;
const ORIENTATIONS = new Set(['portrait', 'landscape']);
const FIT_MODES = new Set(['cover', 'contain']);

function normalizeOrientation(value, fallback = 'portrait') {
  return ORIENTATIONS.has(value) ? value : fallback;
}

function normalizeFitMode(value, fallback = 'cover') {
  return FIT_MODES.has(value) ? value : fallback;
}

// GET /api/kiosks
router.get('/', (req, res) => {
  const kiosks = db.prepare(`
    SELECT k.*,
      COUNT(ki.id) as totalItems,
      SUM(CASE WHEN ki.enabled = 1 THEN 1 ELSE 0 END) as enabledItems
    FROM kiosks k
    LEFT JOIN kiosk_items ki ON ki.kioskId = k.id
    GROUP BY k.id
    ORDER BY k.createdAt DESC
  `).all();
  res.json(kiosks);
});

// POST /api/kiosks
router.post('/', (req, res) => {
  const { name, slug, orientation, fitMode } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'El nombre es requerido' });
  }

  const rawSlug = slug && slug.trim()
    ? slug.trim()
    : name.trim();

  const finalSlug = slugify(rawSlug, { lower: true, strict: true, locale: 'es' });

  if (!finalSlug) {
    return res.status(400).json({ error: 'Slug inválido' });
  }

  // Slugs reservados
  const reserved = ['api', 'admin', 'uploads', 'static'];
  if (reserved.includes(finalSlug)) {
    return res.status(400).json({ error: `El slug "${finalSlug}" está reservado` });
  }

  const existing = db.prepare('SELECT id FROM kiosks WHERE slug = ?').get(finalSlug);
  if (existing) {
    return res.status(400).json({ error: `El slug "${finalSlug}" ya existe` });
  }

  const result = db.prepare(
    'INSERT INTO kiosks (name, slug, orientation, fitMode) VALUES (?, ?, ?, ?)'
  ).run(name.trim(), finalSlug, normalizeOrientation(orientation), normalizeFitMode(fitMode));

  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(kiosk);
});

// GET /api/kiosks/:id
router.get('/:id', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });
  res.json(kiosk);
});

// PUT /api/kiosks/:id
router.put('/:id', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  const { name, slug, enabled, orientation, fitMode } = req.body;

  const newName = (name && name.trim()) ? name.trim() : kiosk.name;
  let newSlug = kiosk.slug;

  if (slug && slug.trim()) {
    newSlug = slugify(slug.trim(), { lower: true, strict: true, locale: 'es' });
    if (!newSlug) return res.status(400).json({ error: 'Slug inválido' });

    const reserved = ['api', 'admin', 'uploads', 'static'];
    if (reserved.includes(newSlug)) {
      return res.status(400).json({ error: `El slug "${newSlug}" está reservado` });
    }

    const existing = db.prepare('SELECT id FROM kiosks WHERE slug = ? AND id != ?').get(newSlug, req.params.id);
    if (existing) {
      return res.status(400).json({ error: `El slug "${newSlug}" ya existe` });
    }

    // Renombrar carpeta de uploads si el slug cambió
    if (newSlug !== kiosk.slug) {
      const oldDir = path.join(UPLOAD_DIR, kiosk.slug);
      const newDir = path.join(UPLOAD_DIR, newSlug);
      if (fs.existsSync(oldDir)) {
        fs.renameSync(oldDir, newDir);
        // Actualizar todos los playlists que apuntan a archivos de este kiosko.
        db.prepare(`
          UPDATE kiosk_items
          SET filePath = REPLACE(filePath, ?, ?)
          WHERE filePath LIKE ?
        `).run(`/${kiosk.slug}/`, `/${newSlug}/`, `/${kiosk.slug}/%`);
      }
    }
  }

  const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : kiosk.enabled;
  const newOrientation = orientation !== undefined
    ? normalizeOrientation(orientation, kiosk.orientation || 'portrait')
    : kiosk.orientation || 'portrait';
  const newFitMode = fitMode !== undefined
    ? normalizeFitMode(fitMode, kiosk.fitMode || 'cover')
    : kiosk.fitMode || 'cover';

  db.prepare(
    "UPDATE kiosks SET name = ?, slug = ?, orientation = ?, fitMode = ?, enabled = ?, updatedAt = datetime('now') WHERE id = ?"
  ).run(newName, newSlug, newOrientation, newFitMode, newEnabled, req.params.id);

  const updated = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/kiosks/:id
router.delete('/:id', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  const filePaths = db.prepare('SELECT filePath FROM kiosk_items WHERE kioskId = ?').all(kiosk.id)
    .map(item => item.filePath);

  db.prepare('DELETE FROM kiosks WHERE id = ?').run(req.params.id);
  deleteUnreferencedFiles(db, UPLOAD_DIR, filePaths);
  res.json({ ok: true });
});

// GET /api/kiosks/:id/items
router.get('/:id/items', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  const items = db.prepare(
    'SELECT * FROM kiosk_items WHERE kioskId = ? ORDER BY sortOrder ASC, id ASC'
  ).all(req.params.id);

  res.json(items);
});

// PUT /api/kiosks/:id/reorder
router.put('/:id/reorder', (req, res) => {
  const { order } = req.body; // array de ids en el nuevo orden
  if (!Array.isArray(order)) {
    return res.status(400).json({ error: 'Se requiere un array "order"' });
  }

  const update = db.prepare('UPDATE kiosk_items SET sortOrder = ? WHERE id = ? AND kioskId = ?');
  const updateMany = db.transaction((items) => {
    items.forEach((id, index) => {
      update.run(index, id, req.params.id);
    });
  });

  updateMany(order);
  res.json({ ok: true });
});

module.exports = router;
