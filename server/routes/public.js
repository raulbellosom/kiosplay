const express = require('express');
const router = express.Router();
const db = require('../db');

// GET /api/public/kiosk/:slug
router.get('/kiosk/:slug', (req, res) => {
  const { slug } = req.params;

  const kiosk = db.prepare('SELECT * FROM kiosks WHERE slug = ?').get(slug);
  if (!kiosk) {
    return res.status(404).json({ error: 'Kiosko no encontrado' });
  }

  const items = db.prepare(`
    SELECT * FROM kiosk_items
    WHERE kioskId = ? AND enabled = 1
    ORDER BY sortOrder ASC, id ASC
  `).all(kiosk.id);

  res.json({
    ...kiosk,
    items,
  });
});

module.exports = router;
