const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const config = require('./config');

const app = express();
const PORT = config.port;
const UPLOAD_DIR = config.paths.uploadDir;
const TEMP_DIR   = config.paths.tempDir;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Middlewares
app.use(cors());
app.use(express.json());

const MEDIA_EXTS = new Set([
  '.mp4', '.webm', '.ogg', '.mov', '.avi', '.mkv',
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
]);

app.use('/uploads', express.static(path.resolve(UPLOAD_DIR), {
  setHeaders(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    if (MEDIA_EXTS.has(ext)) {
      // Allow browsers to cache media for 24 h without revalidation.
      // This fixes large-file (>40 MB) failures on the second play caused
      // by max-age=0 + conditional Range requests returning provisional 304.
      res.setHeader('Cache-Control', 'public, max-age=86400');
    }
  },
}));
app.use('/temp', express.static(path.resolve(TEMP_DIR)));

// Rutas API
app.use('/api/tools',  require('./routes/tools'));
app.use('/api/kiosks', require('./routes/kiosks'));
app.use('/api/kiosks', require('./routes/items'));
app.use('/api/items', require('./routes/items'));
app.use('/api/public', require('./routes/public'));

const tvPlayer = path.join(__dirname, 'public', 'tv.html');
if (fs.existsSync(tvPlayer)) {
  app.get('/tv/:slug', (req, res) => {
    res.sendFile(tvPlayer);
  });
}

// En producción: servir el build del frontend
const clientBuild = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientBuild)) {
  app.use(express.static(clientBuild));
  // SPA fallback: todo lo que no sea API va al index.html
  app.get('*', (req, res) => {
    res.sendFile(path.join(clientBuild, 'index.html'));
  });
}

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
  console.log(`Archivos multimedia en: ${path.resolve(UPLOAD_DIR)}`);
});
