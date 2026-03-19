import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';

const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function AdminKioskEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [kiosk, setKiosk] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  // Campos editables del kiosko
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  // Edición local de duraciones (para que el input no llame a la API en cada tecla)
  const [durationEdits, setDurationEdits] = useState({});

  // Upload
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');

  async function fetchKiosk() {
    try {
      const [kr, ir] = await Promise.all([
        fetch(`/api/kiosks/${id}`),
        fetch(`/api/kiosks/${id}/items`),
      ]);
      if (!kr.ok) { setError('Kiosko no encontrado'); setLoading(false); return; }
      const k = await kr.json();
      const i = await ir.json();
      setKiosk(k);
      setName(k.name);
      setSlug(k.slug);
      setEnabled(!!k.enabled);
      setItems(i);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchKiosk(); }, [id]);

  async function handleSaveKiosk(e) {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await fetch(`/api/kiosks/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando');
      setKiosk(data);
      setSlug(data.slug);
      setSaveMsg('Guardado');
      setTimeout(() => setSaveMsg(''), 2000);
    } catch (e) {
      setSaveMsg('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(files) {
    const valid = Array.from(files).filter(f => ALLOWED_TYPES.includes(f.type));
    if (valid.length === 0) {
      alert('No hay archivos válidos. Formatos permitidos: JPG, PNG, GIF, WEBP, MP4, WEBM, OGG, MOV');
      return;
    }
    if (valid.length < files.length) {
      alert(`Se omitieron ${files.length - valid.length} archivos con formato no permitido.`);
    }

    setUploading(true);
    setUploadProgress(`Subiendo ${valid.length} archivo(s)...`);

    const formData = new FormData();
    valid.forEach(f => formData.append('files', f));

    try {
      const res = await fetch(`/api/kiosks/${id}/items/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error subiendo');
      setUploadProgress(`${valid.length} archivo(s) subido(s)`);
      await fetchKiosk();
      setTimeout(() => setUploadProgress(''), 3000);
    } catch (e) {
      setUploadProgress('Error: ' + e.message);
    } finally {
      setUploading(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragOver(false);
    uploadFiles(e.dataTransfer.files);
  }

  async function handleToggleItem(item) {
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !item.enabled }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDuration(item, val) {
    const dur = Math.max(1, parseInt(val, 10) || 5);
    try {
      const res = await fetch(`/api/items/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ durationSeconds: dur }),
      });
      if (!res.ok) return;
      const updated = await res.json();
      setItems(prev => prev.map(i => i.id === item.id ? updated : i));
    } catch (e) {
      console.error(e);
    }
  }

  async function handleDeleteItem(item) {
    if (!confirm(`¿Eliminar "${item.originalName}"?`)) return;
    try {
      const res = await fetch(`/api/items/${item.id}`, { method: 'DELETE' });
      if (!res.ok) return;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch (e) {
      console.error(e);
    }
  }

  async function moveItem(index, direction) {
    const newItems = [...items];
    const target = index + direction;
    if (target < 0 || target >= newItems.length) return;
    [newItems[index], newItems[target]] = [newItems[target], newItems[index]];
    setItems(newItems);
    try {
      await fetch(`/api/kiosks/${id}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: newItems.map(i => i.id) }),
      });
    } catch (e) {
      console.error(e);
    }
  }

  if (loading) return (
    <div className="admin-layout">
      <header className="admin-header"><span className="logo">◉</span><h1>PVRInfo</h1></header>
      <main className="admin-main"><p style={{ color: 'var(--text-muted)' }}>Cargando...</p></main>
    </div>
  );

  if (error) return (
    <div className="admin-layout">
      <header className="admin-header"><span className="logo">◉</span><h1>PVRInfo</h1></header>
      <main className="admin-main">
        <div className="alert alert-error">{error}</div>
        <Link to="/admin" className="btn btn-ghost">← Volver</Link>
      </main>
    </div>
  );

  const publicUrl = `${window.location.origin}/${kiosk.slug}`;

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <span className="logo">◉</span>
        <h1>PVRInfo</h1>
        <Link to="/admin" style={{ marginLeft: 'auto' }}>← Dashboard</Link>
      </header>

      <main className="admin-main">
        <div className="breadcrumb">
          <Link to="/admin">Kioskos</Link>
          <span>›</span>
          <span>{kiosk.name}</span>
        </div>

        {/* Configuración del kiosko */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Configuración</h3>
          <form onSubmit={handleSaveKiosk}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Nombre</label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Nombre del kiosko"
                />
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Slug (URL)</label>
                <input
                  type="text"
                  value={slug}
                  onChange={e => setSlug(e.target.value)}
                  placeholder="slug-url"
                />
              </div>
            </div>

            <div style={{ marginTop: 16 }} className="url-preview">
              <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>URL pública:</span>
              <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={enabled}
                  onChange={e => setEnabled(e.target.checked)}
                  style={{ width: 'auto' }}
                />
                <span>Kiosko activo (visible públicamente)</span>
              </label>

              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12 }}>
                {saveMsg && (
                  <span style={{
                    fontSize: 12,
                    color: saveMsg.startsWith('Error') ? 'var(--danger)' : 'var(--success)'
                  }}>
                    {saveMsg}
                  </span>
                )}
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Zona de subida */}
        <div className="card" style={{ marginBottom: 24 }}>
          <h3 style={{ marginBottom: 16, fontSize: 16, fontWeight: 600 }}>Subir archivos</h3>
          <div
            className={`drop-zone ${dragOver ? 'drag-over' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div style={{ fontSize: 32 }}>📁</div>
            <p>Arrastra imágenes o videos aquí, o haz clic para seleccionar</p>
            <p style={{ fontSize: 11, marginTop: 4 }}>JPG, PNG, GIF, WEBP, MP4, WEBM — Máx. 200 MB por archivo</p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/*,video/*"
            style={{ display: 'none' }}
            onChange={e => uploadFiles(e.target.files)}
          />
          {uploadProgress && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
              {uploading && <span>⏳ </span>}
              {uploadProgress}
            </div>
          )}
        </div>

        {/* Lista de items */}
        <div className="card">
          <div className="section-header">
            <h3 style={{ fontSize: 16, fontWeight: 600 }}>
              Playlist ({items.length} elemento{items.length !== 1 ? 's' : ''})
            </h3>
            {items.length > 0 && (
              <a
                href={`/${kiosk.slug}`}
                target="_blank"
                rel="noreferrer"
                className="btn btn-ghost btn-sm"
              >
                Vista previa →
              </a>
            )}
          </div>

          {items.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <p>Sin elementos. Sube imágenes o videos arriba para comenzar.</p>
            </div>
          ) : (
            <div className="items-list">
              {items.map((item, index) => (
                <div
                  key={item.id}
                  className={`item-row ${!item.enabled ? 'disabled-item' : ''}`}
                >
                  {/* Miniatura */}
                  {item.type === 'image' ? (
                    <img
                      src={`/uploads${item.filePath}`}
                      alt={item.originalName}
                      className="item-thumb"
                    />
                  ) : (
                    <div className="item-thumb-video">▶</div>
                  )}

                  {/* Info */}
                  <div className="item-info">
                    <div className="item-name" title={item.originalName}>
                      {item.originalName}
                    </div>
                    <div className="item-meta">
                      <span style={{
                        background: item.type === 'image' ? 'rgba(88,101,242,0.15)' : 'rgba(87,242,135,0.1)',
                        color: item.type === 'image' ? '#a5b4fc' : 'var(--success)',
                        padding: '1px 6px',
                        borderRadius: 4,
                        fontSize: 10,
                        fontWeight: 600,
                      }}>
                        {item.type === 'image' ? 'IMG' : 'VID'}
                      </span>
                      <span>{formatBytes(item.size)}</span>
                    </div>
                  </div>

                  {/* Duración (solo imágenes) */}
                  {item.type === 'image' ? (
                    <div className="item-duration">
                      <input
                        type="number"
                        min="1"
                        max="300"
                        value={durationEdits[item.id] ?? item.durationSeconds}
                        onChange={e => setDurationEdits(prev => ({ ...prev, [item.id]: e.target.value }))}
                        onBlur={e => {
                          handleDuration(item, e.target.value);
                          setDurationEdits(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                        }}
                        title="Duración en segundos"
                      />
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>seg</span>
                    </div>
                  ) : (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', minWidth: 70, textAlign: 'center' }}>
                      Duración completa
                    </div>
                  )}

                  {/* Acciones */}
                  <div className="item-actions">
                    <button
                      className="btn-icon"
                      onClick={() => moveItem(index, -1)}
                      disabled={index === 0}
                      title="Subir"
                    >↑</button>
                    <button
                      className="btn-icon"
                      onClick={() => moveItem(index, 1)}
                      disabled={index === items.length - 1}
                      title="Bajar"
                    >↓</button>
                    <button
                      className="btn-icon"
                      onClick={() => handleToggleItem(item)}
                      title={item.enabled ? 'Desactivar' : 'Activar'}
                      style={{ color: item.enabled ? 'var(--success)' : 'var(--danger)' }}
                    >
                      {item.enabled ? '●' : '○'}
                    </button>
                    <button
                      className="btn-icon"
                      onClick={() => handleDeleteItem(item)}
                      title="Eliminar"
                      style={{ color: 'var(--danger)' }}
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
