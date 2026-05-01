const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');

function loadEnvFile(filePath) {
  if (fs.existsSync(filePath)) {
    dotenv.config({ path: filePath, override: false });
  }
}

loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(__dirname, '.env'));

function resolvePersistentPath(value, fallback) {
  const raw = value || fallback;
  return path.isAbsolute(raw) ? raw : path.resolve(rootDir, raw);
}

const paths = {
  rootDir,
  serverDir: __dirname,
  sqlitePath: resolvePersistentPath(process.env.SQLITE_PATH, './data/kiosko.db'),
  uploadDir: resolvePersistentPath(process.env.UPLOAD_DIR, './uploads'),
  tempDir: resolvePersistentPath(process.env.TEMP_DIR, './temp'),
};

module.exports = {
  port: process.env.PORT || 3001,
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '200', 10),
  paths,
};
