require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const TEMP_DIR   = process.env.TEMP_DIR   || './temp';

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(TEMP_DIR, { recursive: true });

// Middlewares
app.use(cors());
app.use(express.json());

app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)));
app.use('/temp',    express.static(path.resolve(TEMP_DIR)));

// Rutas API
app.use('/api/tools',  require('./routes/tools'));
app.use('/api/kiosks', require('./routes/kiosks'));
app.use('/api/kiosks', require('./routes/items'));
app.use('/api/items', require('./routes/items'));
app.use('/api/public', require('./routes/public'));

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
