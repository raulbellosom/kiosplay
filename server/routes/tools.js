const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const { fromPath } = require('pdf2pic');
const db = require('../db');

ffmpeg.setFfmpegPath(ffmpegPath);

const TEMP_DIR = process.env.TEMP_DIR || './temp';
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';

fs.mkdirSync(TEMP_DIR, { recursive: true });

// ─── Multer: guarda en una carpeta temporal por job ───────────────────────────
const toolsStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (!req.jobId) {
      req.jobId = randomUUID();
      req.jobDir = path.join(TEMP_DIR, req.jobId);
      fs.mkdirSync(req.jobDir, { recursive: true });
    }
    cb(null, req.jobDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const base = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9._-]/g, '_')
      .substring(0, 60);
    cb(null, `${base}${ext}`);
  },
});

const toolsUpload = multer({
  storage: toolsStorage,
  limits: { fileSize: 500 * 1024 * 1024 },
});

function cleanupJob(jobId) {
  const dir = path.join(TEMP_DIR, jobId);
  if (fs.existsSync(dir)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function formatBytes(bytes) {
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── GET /api/tools/result/:jobId/:filename ───────────────────────────────────
router.get('/result/:jobId/:filename', (req, res) => {
  // Evitar path traversal
  const jobId = path.basename(req.params.jobId);
  const filename = path.basename(req.params.filename);
  const filePath = path.join(TEMP_DIR, jobId, filename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'Archivo no encontrado' });
  }
  res.download(filePath, filename);
});

// ─── POST /api/tools/video-to-gif ─────────────────────────────────────────────
router.post('/video-to-gif', toolsUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const start    = Math.max(0, parseFloat(req.body.start)    || 0);
  const duration = Math.min(60, Math.max(1, parseFloat(req.body.duration) || 10));
  const fps      = Math.min(30, Math.max(1, parseInt(req.body.fps)        || 10));
  const scale    = Math.min(1280, Math.max(120, parseInt(req.body.scale)  || 480));

  const { jobId, jobDir } = req;
  const inputPath  = req.file.path;
  const outputFile = 'output.gif';
  const outputPath = path.join(jobDir, outputFile);

  try {
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .setStartTime(start)
        .setDuration(duration)
        .outputOptions([
          `-vf fps=${fps},scale=${scale}:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse`,
          '-loop 0',
        ])
        .output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const size = fs.statSync(outputPath).size;
    res.json({
      jobId,
      filename: outputFile,
      url: `/api/tools/result/${jobId}/${outputFile}`,
      size,
      sizeLabel: formatBytes(size),
    });
  } catch (err) {
    cleanupJob(jobId);
    res.status(500).json({ error: 'Error convirtiendo a GIF: ' + err.message });
  }
});

// ─── POST /api/tools/compress-video ───────────────────────────────────────────
router.post('/compress-video', toolsUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const quality  = req.body.quality || 'medium';
  const maxWidth = parseInt(req.body.maxWidth) || 0;

  const { jobId, jobDir } = req;
  const inputPath    = req.file.path;
  const ext          = path.extname(req.file.originalname).toLowerCase() || '.mp4';
  const outputFile   = `compressed${ext}`;
  const outputPath   = path.join(jobDir, outputFile);
  const originalSize = req.file.size;

  // CRF: menor = mejor calidad y archivo más grande
  const crfMap = { high: 20, medium: 28, low: 36 };
  const crf = crfMap[quality] || 28;

  try {
    await new Promise((resolve, reject) => {
      let cmd = ffmpeg(inputPath)
        .videoCodec('libx264')
        .addOption('-crf', String(crf))
        .addOption('-preset', 'fast')
        .audioCodec('aac')
        .addOption('-movflags', '+faststart');

      if (maxWidth > 0) {
        cmd = cmd.videoFilters(`scale='min(${maxWidth},iw)':-2`);
      }

      cmd.output(outputPath)
        .on('end', resolve)
        .on('error', reject)
        .run();
    });

    const newSize   = fs.statSync(outputPath).size;
    const reduction = Math.round((1 - newSize / originalSize) * 100);

    res.json({
      jobId,
      filename: outputFile,
      url: `/api/tools/result/${jobId}/${outputFile}`,
      originalSize,
      newSize,
      reduction,
      originalLabel: formatBytes(originalSize),
      newLabel: formatBytes(newSize),
    });
  } catch (err) {
    cleanupJob(jobId);
    res.status(500).json({ error: 'Error comprimiendo video: ' + err.message });
  }
});

// ─── POST /api/tools/pdf-to-images ────────────────────────────────────────────
router.post('/pdf-to-images', toolsUpload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se recibió archivo' });

  const dpi    = Math.min(300, Math.max(72, parseInt(req.body.dpi) || 150));
  const format = req.body.format === 'jpg' ? 'jpeg' : 'png';

  const { jobId, jobDir } = req;

  try {
    const converter = fromPath(req.file.path, {
      density: dpi,
      saveFilename: 'page',
      savePath: jobDir,
      format,
      width: 1920,
    });

    const results = await converter.bulk(-1, { responseType: 'image' });

    const files = results
      .filter(r => r.path && fs.existsSync(r.path))
      .map((r, i) => {
        const filename = path.basename(r.path);
        const size     = fs.statSync(r.path).size;
        return {
          page: i + 1,
          filename,
          url: `/api/tools/result/${jobId}/${filename}`,
          size,
          sizeLabel: formatBytes(size),
        };
      });

    res.json({ jobId, files });
  } catch (err) {
    cleanupJob(jobId);
    const msg = err.message || '';
    const hint = msg.toLowerCase().includes('magick') || msg.toLowerCase().includes('gs')
      ? ' Asegúrate de tener ImageMagick y Ghostscript instalados.'
      : '';
    res.status(500).json({ error: 'Error convirtiendo PDF: ' + msg + hint });
  }
});

// ─── POST /api/tools/add-to-kiosk ─────────────────────────────────────────────
router.post('/add-to-kiosk', express.json(), (req, res) => {
  const { jobId, filename, kioskId } = req.body;
  if (!jobId || !filename || !kioskId) {
    return res.status(400).json({ error: 'Faltan parámetros: jobId, filename, kioskId' });
  }

  const kiosk = db.prepare('SELECT * FROM kiosks WHERE id = ?').get(kioskId);
  if (!kiosk) return res.status(404).json({ error: 'Kiosko no encontrado' });

  // Prevenir path traversal
  const srcPath = path.join(TEMP_DIR, path.basename(jobId), path.basename(filename));
  if (!fs.existsSync(srcPath)) {
    return res.status(404).json({ error: 'Archivo temporal no encontrado' });
  }

  const ext = path.extname(filename).toLowerCase();
  const mimeMap = {
    '.gif': 'image/gif',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.mov': 'video/quicktime',
  };
  const typeMap = {
    'image/gif': 'image', 'image/png': 'image', 'image/jpeg': 'image',
    'video/mp4': 'video', 'video/webm': 'video', 'video/quicktime': 'video',
  };
  const mimeType = mimeMap[ext] || 'application/octet-stream';
  const type     = typeMap[mimeType] || 'image';

  const destDir  = path.join(UPLOAD_DIR, kiosk.slug);
  fs.mkdirSync(destDir, { recursive: true });

  const unique      = `${Date.now()}-${Math.round(Math.random() * 1e6)}`;
  const destFile    = `${path.basename(filename, ext)}-${unique}${ext}`;
  const destPath    = path.join(destDir, destFile);

  fs.copyFileSync(srcPath, destPath);

  const stat     = fs.statSync(destPath);
  const maxOrder = db.prepare('SELECT MAX(sortOrder) as m FROM kiosk_items WHERE kioskId = ?').get(kioskId);
  const order    = (maxOrder?.m ?? -1) + 1;

  const result = db.prepare(`
    INSERT INTO kiosk_items (kioskId, type, filename, originalName, filePath, mimeType, size, sortOrder)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(kiosk.id, type, destFile, filename, `/${kiosk.slug}/${destFile}`, mimeType, stat.size, order);

  const item = db.prepare('SELECT * FROM kiosk_items WHERE id = ?').get(result.lastInsertRowid);
  res.json(item);
});

// ─── DELETE /api/tools/job/:jobId ─────────────────────────────────────────────
router.delete('/job/:jobId', (req, res) => {
  cleanupJob(path.basename(req.params.jobId));
  res.json({ ok: true });
});

module.exports = router;
