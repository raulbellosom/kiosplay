const express = require('express');
const router = express.Router();
const db = require('../db');
const slugify = require('slugify');
const path = require('path');
const fs = require('fs');

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

// GET /api/kiosks
router.get('/', (req, res) => {
  const kiosks = db.prepare('SELECT * FROM kiosks ORDER BY createdAt DESC').all();
  res.json(kiosks);
});

// POST /api/kiosks
router.post('/', (req, res) => {
  const { name, slug } = req.body;

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
    'INSERT INTO kiosks (name, slug) VALUES (?, ?)'
  ).run(name.trim(), finalSlug);

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

  const { name, slug, enabled } = req.body;

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
        // Actualizar paths en DB
        db.prepare(`
          UPDATE kiosk_items
          SET filePath = REPLACE(filePath, ?, ?)
          WHERE kioskId = ?
        `).run(`/${kiosk.slug}/`, `/${newSlug}/`, kiosk.id);
      }
    }
  }

  const newEnabled = enabled !== undefined ? (enabled ? 1 : 0) : kiosk.enabled;

  db.prepare(
    "UPDATE kiosks SET name = ?, slug = ?, enabled = ?, updatedAt = datetime('now') WHERE id = ?"
  ).run(newName, newSlug, newEnabled, req.params.id);

  const updated = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  res.json(updated);
});

// DELETE /api/kiosks/:id
router.delete('/:id', (req, res) => {
  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(req.params.id);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  // Eliminar archivos del disco
  const kioskDir = path.join(UPLOAD_DIR, kiosk.slug);
  if (fs.existsSync(kioskDir)) {
    fs.rmSync(kioskDir, { recursive: true, force: true });
  }

  db.prepare('DELETE FROM kiosks WHERE id = ?').run(req.params.id);
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
