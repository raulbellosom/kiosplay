const fs = require('fs');
const path = require('path');

function resolveUploadPath(uploadDir, filePath) {
  const relativePath = String(filePath || '').replace(/^[/\\]+/, '');
  const resolved = path.resolve(uploadDir, relativePath);
  const root = path.resolve(uploadDir);

  if (resolved !== root && !resolved.startsWith(root + path.sep)) {
    throw new Error('Ruta de archivo invalida');
  }

  return resolved;
}

function deleteFileIfUnreferenced(db, uploadDir, filePath) {
  const refs = db.prepare('SELECT COUNT(*) as c FROM kiosk_items WHERE filePath = ?').get(filePath);
  if ((refs?.c || 0) > 0) return false;

  const absolutePath = resolveUploadPath(uploadDir, filePath);
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
    return true;
  }

  return false;
}

function deleteUnreferencedFiles(db, uploadDir, filePaths) {
  return Array.from(new Set(filePaths || []))
    .map(filePath => deleteFileIfUnreferenced(db, uploadDir, filePath))
    .filter(Boolean).length;
}

module.exports = {
  deleteFileIfUnreferenced,
  deleteUnreferencedFiles,
  resolveUploadPath,
};
