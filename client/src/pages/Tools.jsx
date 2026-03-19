import React, { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';

const TABS = [
  { id: 'gif',      label: 'Video → GIF' },
  { id: 'compress', label: 'Comprimir Video' },
  { id: 'pdf',      label: 'PDF → Imágenes' },
];

function formatBytes(bytes) {
  if (!bytes) return '0 B';
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

// ─── Selector de kiosko (modal inline) ────────────────────────────────────────
function KioskSelector({ kiosks, onSelect, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ minWidth: 320 }} onClick={e => e.stopPropagation()}>
        <h3 style={{ marginBottom: 16 }}>Agregar a kiosko</h3>
        {kiosks.length === 0
          ? <p style={{ color: 'var(--text-muted)' }}>No hay kioskos creados.</p>
          : kiosks.map(k => (
            <button
              key={k.id}
              className="btn btn-ghost"
              style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 6 }}
              onClick={() => onSelect(k)}
            >
              {k.name}
              <span style={{ color: 'var(--text-muted)', fontSize: 11, marginLeft: 8 }}>/{k.slug}</span>
            </button>
          ))
        }
        <button className="btn btn-ghost" style={{ marginTop: 12 }} onClick={onClose}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

// ─── Drop Zone ────────────────────────────────────────────────────────────────
function DropZone({ accept, label, hint, onFiles, disabled }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);

  return (
    <div
      className={`drop-zone ${over ? 'drag-over' : ''} ${disabled ? 'disabled' : ''}`}
      style={{ opacity: disabled ? 0.5 : 1, pointerEvents: disabled ? 'none' : 'auto' }}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files); }}
      onClick={() => ref.current?.click()}
    >
      <div style={{ fontSize: 28 }}>📁</div>
      <p>{label}</p>
      <p style={{ fontSize: 11, marginTop: 4, color: 'var(--text-muted)' }}>{hint}</p>
      <input ref={ref} type="file" accept={accept} style={{ display: 'none' }}
        onChange={e => onFiles(e.target.files)} />
    </div>
  );
}

// ─── TAB: Video → GIF ─────────────────────────────────────────────────────────
function VideoToGif({ kiosks }) {
  const [params, setParams] = useState({ start: 0, duration: 10, fps: 10, scale: 480 });
  const [status, setStatus] = useState('idle'); // idle | converting | done | error
  const [result, setResult] = useState(null);
  const [error, setError]   = useState('');
  const [selector, setSelector] = useState(false);
  const [addMsg, setAddMsg]     = useState('');

  function set(k, v) { setParams(p => ({ ...p, [k]: v })); }

  async function convert(files) {
    const file = files[0];
    if (!file || !file.type.startsWith('video/')) {
      setError('Selecciona un archivo de video.'); return;
    }
    setStatus('converting'); setError(''); setResult(null); setAddMsg('');
    const fd = new FormData();
    fd.append('file', file);
    Object.entries(params).forEach(([k, v]) => fd.append(k, v));

    try {
      const res  = await fetch('/api/tools/video-to-gif', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  async function addToKiosk(kiosk) {
    setSelector(false);
    try {
      const res = await fetch('/api/tools/add-to-kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: result.jobId, filename: result.filename, kioskId: kiosk.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAddMsg(`Agregado a "${kiosk.name}"`);
    } catch (e) {
      setAddMsg('Error: ' + e.message);
    }
  }

  return (
    <div>
      <DropZone
        accept="video/*"
        label="Arrastra un video aquí o haz clic para seleccionar"
        hint="MP4, WEBM, MOV — Máx. 500 MB"
        onFiles={convert}
        disabled={status === 'converting'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginTop: 16 }}>
        {[
          { key: 'start',    label: 'Inicio (seg)',     min: 0,   max: 3600, step: 1   },
          { key: 'duration', label: 'Duración (seg)',   min: 1,   max: 60,   step: 1   },
          { key: 'fps',      label: 'FPS',              min: 1,   max: 30,   step: 1   },
          { key: 'scale',    label: 'Ancho (px)',       min: 120, max: 1280, step: 40  },
        ].map(({ key, label, min, max, step }) => (
          <div key={key} className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: 11 }}>{label}</label>
            <input type="number" min={min} max={max} step={step}
              value={params[key]} onChange={e => set(key, e.target.value)} />
          </div>
        ))}
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        FPS bajo (8–12) y ancho pequeño (320–480) producen GIFs más ligeros.
      </p>

      {status === 'converting' && (
        <div style={{ marginTop: 16, color: 'var(--text-muted)' }}>
          ⏳ Convirtiendo… esto puede tardar según la duración del video.
        </div>
      )}
      {status === 'error' && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>
      )}

      {status === 'done' && result && (
        <div className="card" style={{ marginTop: 20, padding: 16 }}>
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <img src={result.url} alt="GIF preview"
              style={{ maxWidth: 240, maxHeight: 180, borderRadius: 6, objectFit: 'contain', background: '#000' }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>GIF generado</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 16 }}>
                Tamaño: {result.sizeLabel}
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <a href={result.url} download={result.filename} className="btn btn-primary btn-sm">
                  Descargar
                </a>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelector(true)}>
                  + Agregar a kiosko
                </button>
              </div>
              {addMsg && (
                <div style={{ marginTop: 8, fontSize: 12,
                  color: addMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                  {addMsg}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selector && (
        <KioskSelector kiosks={kiosks} onSelect={addToKiosk} onClose={() => setSelector(false)} />
      )}
    </div>
  );
}

// ─── TAB: Comprimir Video ──────────────────────────────────────────────────────
function CompressVideo({ kiosks }) {
  const [quality,  setQuality]  = useState('medium');
  const [maxWidth, setMaxWidth] = useState('');
  const [status,   setStatus]   = useState('idle');
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState('');
  const [selector, setSelector] = useState(false);
  const [addMsg,   setAddMsg]   = useState('');

  async function compress(files) {
    const file = files[0];
    if (!file || !file.type.startsWith('video/')) {
      setError('Selecciona un archivo de video.'); return;
    }
    setStatus('converting'); setError(''); setResult(null); setAddMsg('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('quality', quality);
    if (maxWidth) fd.append('maxWidth', maxWidth);

    try {
      const res  = await fetch('/api/tools/compress-video', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  async function addToKiosk(kiosk) {
    setSelector(false);
    try {
      const res = await fetch('/api/tools/add-to-kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: result.jobId, filename: result.filename, kioskId: kiosk.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setAddMsg(`Agregado a "${kiosk.name}"`);
    } catch (e) {
      setAddMsg('Error: ' + e.message);
    }
  }

  return (
    <div>
      <DropZone
        accept="video/*"
        label="Arrastra un video aquí o haz clic para seleccionar"
        hint="MP4, WEBM, MOV — Máx. 500 MB"
        onFiles={compress}
        disabled={status === 'converting'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 11 }}>Calidad</label>
          <select value={quality} onChange={e => setQuality(e.target.value)}>
            <option value="high">Alta   (CRF 20 — archivo más grande)</option>
            <option value="medium">Media  (CRF 28 — balance)</option>
            <option value="low">Baja   (CRF 36 — archivo más pequeño)</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 11 }}>Ancho máximo (px, opcional)</label>
          <input type="number" min="240" max="3840" step="80" placeholder="Ej: 1280 — deja vacío para no cambiar"
            value={maxWidth} onChange={e => setMaxWidth(e.target.value)} />
        </div>
      </div>

      {status === 'converting' && (
        <div style={{ marginTop: 16, color: 'var(--text-muted)' }}>
          ⏳ Comprimiendo… puede tardar varios minutos en videos largos.
        </div>
      )}
      {status === 'error' && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>
      )}

      {status === 'done' && result && (
        <div className="card" style={{ marginTop: 20, padding: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 12 }}>Video comprimido</div>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, fontSize: 13 }}>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Original</div>
              <div>{result.originalLabel}</div>
            </div>
            <div style={{ color: 'var(--text-muted)', alignSelf: 'center', fontSize: 20 }}>→</div>
            <div>
              <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>Comprimido</div>
              <div>{result.newLabel}</div>
            </div>
            <div style={{
              background: 'rgba(87,242,135,0.1)', color: 'var(--success)',
              padding: '4px 10px', borderRadius: 6, alignSelf: 'center', fontWeight: 700
            }}>
              -{result.reduction}%
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href={result.url} download={result.filename} className="btn btn-primary btn-sm">
              Descargar
            </a>
            <button className="btn btn-ghost btn-sm" onClick={() => setSelector(true)}>
              + Agregar a kiosko
            </button>
          </div>
          {addMsg && (
            <div style={{ marginTop: 8, fontSize: 12,
              color: addMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
              {addMsg}
            </div>
          )}
        </div>
      )}

      {selector && (
        <KioskSelector kiosks={kiosks} onSelect={addToKiosk} onClose={() => setSelector(false)} />
      )}
    </div>
  );
}

// ─── TAB: PDF → Imágenes ──────────────────────────────────────────────────────
function PdfToImages({ kiosks }) {
  const [dpi,      setDpi]      = useState(150);
  const [format,   setFormat]   = useState('png');
  const [status,   setStatus]   = useState('idle');
  const [result,   setResult]   = useState(null);  // { jobId, files: [] }
  const [error,    setError]    = useState('');
  const [selector, setSelector] = useState(null);  // null | { single: file } | { all: true }
  const [addMsgs,  setAddMsgs]  = useState({});    // { filename: msg }
  const [selected, setSelected] = useState({});    // { filename: bool }

  async function convert(files) {
    const file = files[0];
    if (!file || file.type !== 'application/pdf') {
      setError('Selecciona un archivo PDF.'); return;
    }
    setStatus('converting'); setError(''); setResult(null); setAddMsgs({}); setSelected({});
    const fd = new FormData();
    fd.append('file', file);
    fd.append('dpi', dpi);
    fd.append('format', format);

    try {
      const res  = await fetch('/api/tools/pdf-to-images', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setResult(data);
      // Select all by default
      const sel = {};
      data.files.forEach(f => { sel[f.filename] = true; });
      setSelected(sel);
      setStatus('done');
    } catch (e) {
      setError(e.message);
      setStatus('error');
    }
  }

  async function addFileToKiosk(file, kiosk) {
    try {
      const res = await fetch('/api/tools/add-to-kiosk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: result.jobId, filename: file.filename, kioskId: kiosk.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      return null;
    } catch (e) {
      return e.message;
    }
  }

  async function handleAddSingle(file, kiosk) {
    setSelector(null);
    const err = await addFileToKiosk(file, kiosk);
    setAddMsgs(m => ({ ...m, [file.filename]: err ? 'Error: ' + err : `Agregado a "${kiosk.name}"` }));
  }

  async function handleAddSelected(kiosk) {
    setSelector(null);
    const toAdd = result.files.filter(f => selected[f.filename]);
    const msgs  = {};
    for (const f of toAdd) {
      const err = await addFileToKiosk(f, kiosk);
      msgs[f.filename] = err ? 'Error: ' + err : `Agregado a "${kiosk.name}"`;
    }
    setAddMsgs(msgs);
  }

  const selectedCount = Object.values(selected).filter(Boolean).length;

  return (
    <div>
      <DropZone
        accept="application/pdf"
        label="Arrastra un PDF aquí o haz clic para seleccionar"
        hint="Archivos PDF — cada página se convierte en una imagen"
        onFiles={convert}
        disabled={status === 'converting'}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 16 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 11 }}>Resolución (DPI)</label>
          <select value={dpi} onChange={e => setDpi(Number(e.target.value))}>
            <option value={72}>72 DPI — baja resolución</option>
            <option value={150}>150 DPI — estándar</option>
            <option value={200}>200 DPI — buena calidad</option>
            <option value={300}>300 DPI — alta resolución</option>
          </select>
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label style={{ fontSize: 11 }}>Formato de salida</label>
          <select value={format} onChange={e => setFormat(e.target.value)}>
            <option value="png">PNG (sin pérdida)</option>
            <option value="jpg">JPG (archivo más pequeño)</option>
          </select>
        </div>
      </div>
      <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
        Requiere ImageMagick + Ghostscript instalados. Ver README para instrucciones.
      </p>

      {status === 'converting' && (
        <div style={{ marginTop: 16, color: 'var(--text-muted)' }}>
          ⏳ Convirtiendo páginas…
        </div>
      )}
      {status === 'error' && (
        <div className="alert alert-error" style={{ marginTop: 16 }}>{error}</div>
      )}

      {status === 'done' && result && (
        <div className="card" style={{ marginTop: 20, padding: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <span style={{ fontWeight: 600 }}>{result.files.length} página{result.files.length !== 1 ? 's' : ''}</span>
            <button className="btn btn-ghost btn-sm"
              onClick={() => setSelected(Object.fromEntries(result.files.map(f => [f.filename, true])))}>
              Seleccionar todas
            </button>
            <button className="btn btn-ghost btn-sm"
              onClick={() => setSelected({})}>
              Quitar selección
            </button>
            {selectedCount > 0 && (
              <button className="btn btn-primary btn-sm" onClick={() => setSelector({ all: true })}>
                + Agregar {selectedCount} seleccionada{selectedCount !== 1 ? 's' : ''} a kiosko
              </button>
            )}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
            gap: 12,
          }}>
            {result.files.map(file => (
              <div key={file.filename} style={{
                background: 'var(--bg3)',
                border: `2px solid ${selected[file.filename] ? 'var(--accent)' : 'var(--border)'}`,
                borderRadius: 8,
                overflow: 'hidden',
                cursor: 'pointer',
              }}
                onClick={() => setSelected(s => ({ ...s, [file.filename]: !s[file.filename] }))}
              >
                <div style={{ position: 'relative' }}>
                  <img src={file.url} alt={`Página ${file.page}`}
                    style={{ width: '100%', display: 'block', maxHeight: 200, objectFit: 'contain', background: '#fff' }} />
                  {selected[file.filename] && (
                    <div style={{
                      position: 'absolute', top: 6, right: 6,
                      background: 'var(--accent)', borderRadius: '50%',
                      width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 12, fontWeight: 700,
                    }}>✓</div>
                  )}
                </div>
                <div style={{ padding: '8px 10px' }}>
                  <div style={{ fontSize: 12, fontWeight: 600 }}>Página {file.page}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{file.sizeLabel}</div>
                  {addMsgs[file.filename] && (
                    <div style={{ fontSize: 10, marginTop: 2,
                      color: addMsgs[file.filename].startsWith('Error') ? 'var(--danger)' : 'var(--success)' }}>
                      {addMsgs[file.filename]}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 4, marginTop: 6 }}
                    onClick={e => e.stopPropagation()}>
                    <a href={file.url} download={file.filename}
                      className="btn btn-ghost btn-sm" style={{ flex: 1, textAlign: 'center', fontSize: 11, padding: '4px 6px' }}>
                      Descargar
                    </a>
                    <button className="btn btn-ghost btn-sm"
                      style={{ flex: 1, fontSize: 11, padding: '4px 6px' }}
                      onClick={() => setSelector({ single: file })}>
                      +Kiosko
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selector?.single && (
        <KioskSelector
          kiosks={kiosks}
          onSelect={k => handleAddSingle(selector.single, k)}
          onClose={() => setSelector(null)}
        />
      )}
      {selector?.all && (
        <KioskSelector
          kiosks={kiosks}
          onSelect={k => handleAddSelected(k)}
          onClose={() => setSelector(null)}
        />
      )}
    </div>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────
export default function Tools() {
  const [tab,    setTab]    = useState('gif');
  const [kiosks, setKiosks] = useState([]);

  useEffect(() => {
    fetch('/api/kiosks')
      .then(r => r.json())
      .then(setKiosks)
      .catch(() => {});
  }, []);

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <span className="logo">◉</span>
        <h1>PVRInfo — Herramientas</h1>
        <Link to="/admin" style={{ marginLeft: 'auto' }}>← Dashboard</Link>
      </header>

      <main className="admin-main">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: tab === t.id ? '2px solid var(--accent)' : '2px solid transparent',
                borderRadius: 0,
                color: tab === t.id ? 'var(--text)' : 'var(--text-muted)',
                fontWeight: tab === t.id ? 600 : 400,
                padding: '8px 20px',
                cursor: 'pointer',
                marginBottom: -1,
                fontSize: 14,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Contenido del tab */}
        <div className="card" style={{ padding: 24 }}>
          {tab === 'gif'      && <VideoToGif    kiosks={kiosks} />}
          {tab === 'compress' && <CompressVideo  kiosks={kiosks} />}
          {tab === 'pdf'      && <PdfToImages    kiosks={kiosks} />}
        </div>
      </main>
    </div>
  );
}
