const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const rootDir = path.resolve(__dirname, '..');

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), 'utf8');
}

test('service worker supports shell caching, navigation fallback, and playlist preloading', () => {
  const sw = read('client/public/sw.js');

  assert.match(sw, /APP_SHELL_CACHE/);
  assert.match(sw, /event\.request\.mode === ['"]navigate['"]/);
  assert.match(sw, /PRECACHE_MEDIA/);
  assert.match(sw, /cache\.addAll\(APP_SHELL_URLS\)/);
});

test('modern kiosk view persists the last valid playlist and asks the service worker to preload media', () => {
  const view = read('client/src/pages/KioskView.jsx');
  const css = read('client/src/index.css');

  assert.match(view, /localStorage/);
  assert.match(view, /kiosk-cache:/);
  assert.match(view, /PRECACHE_MEDIA/);
  assert.match(view, /playlistSignature/);
  assert.match(view, /player-fullscreen--\$\{orientation\}/);
  assert.match(css, /player-fullscreen--portrait/);
  assert.match(css, /player-fullscreen--landscape/);
});

test('admin UI exposes kiosk orientation and server exposes the TV legacy route', () => {
  const admin = read('client/src/pages/AdminKioskEdit.jsx');
  const app = read('server/app.js');

  assert.match(admin, /orientation/);
  assert.match(admin, /portrait/);
  assert.match(admin, /landscape/);
  assert.match(app, /\/tv\/:slug/);
  assert.ok(fs.existsSync(path.join(rootDir, 'server', 'public', 'tv.html')));
});

test('admin and player expose fit mode and existing-media reuse controls', () => {
  const admin = read('client/src/pages/AdminKioskEdit.jsx');
  const modernPlayer = read('client/src/pages/KioskView.jsx');
  const legacyPlayer = read('server/public/tv.html');
  const routes = read('server/routes/items.js');

  assert.match(admin, /fitMode/);
  assert.match(admin, /existing/i);
  assert.match(modernPlayer, /objectFit:\s*fitMode/);
  assert.match(legacyPlayer, /objectFit/);
  assert.match(routes, /from-existing/);
});
