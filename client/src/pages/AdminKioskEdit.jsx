import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
} from '@dnd-kit/core';
import {
  SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, arrayMove,
} from '@dnd-kit/sortable';
import {
  Upload, CheckCircle, XCircle, Loader2, ExternalLink, Eye,
  AlertCircle, List, ToggleLeft, ToggleRight, X,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';
import SortablePlaylistItem from '../components/SortablePlaylistItem';
import MediaModal from '../components/MediaModal';

const ALLOWED_TYPES = [
  'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime',
];

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function SaveStatus({ saving, saveMsg }) {
  if (saving) {
    return (
      <span className="status-badge status-badge-saving">
        <Loader2 size={12} className="spin" /> Guardando...
      </span>
    );
  }
  if (!saveMsg) return null;
  const isError = saveMsg.startsWith('Error');
  return (
    <span className={`status-badge ${isError ? 'status-badge-error' : 'status-badge-success'}`}>
      {isError ? <XCircle size={12} /> : <CheckCircle size={12} />}
      {saveMsg}
    </span>
  );
}

export default function AdminKioskEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [kiosk, setKiosk] = useState(null);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saveMsg, setSaveMsg] = useState('');
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [orientation, setOrientation] = useState('portrait');
  const [fitMode, setFitMode] = useState('cover');
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [durationEdits, setDurationEdits] = useState({});

  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');
  const [uploadError, setUploadError] = useState(false);

  // Media modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [existingOpen, setExistingOpen] = useState(false);
  const [existingItems, setExistingItems] = useState([]);
  const [existingLoading, setExistingLoading] = useState(false);
  const [existingMsg, setExistingMsg] = useState('');
  const [selectedExisting, setSelectedExisting] = useState([]);

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      setOrientation(k.orientation === 'landscape' ? 'landscape' : 'portrait');
      setFitMode(k.fitMode === 'contain' ? 'contain' : 'cover');
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
        body: JSON.stringify({ name, slug, orientation, fitMode, enabled }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error guardando');
      setKiosk(data);
      setSlug(data.slug);
      setSaveMsg('Guardado');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (e) {
      setSaveMsg('Error: ' + e.message);
      setTimeout(() => setSaveMsg(''), 5000);
    } finally {
      setSaving(false);
    }
  }

  async function uploadFiles(files) {
    const valid = Array.from(files).filter(f => ALLOWED_TYPES.includes(f.type));
    if (valid.length === 0) {
      setUploadMsg('No hay archivos válidos. Formatos: JPG, PNG, GIF, WEBP, MP4, WEBM, MOV');
      setUploadError(true);
      setTimeout(() => { setUploadMsg(''); setUploadError(false); }, 5000);
      return;
    }
    if (valid.length < files.length) {
      setUploadMsg(`Se omitieron ${files.length - valid.length} archivo(s) con formato no permitido`);
      setUploadError(true);
    }

    setUploading(true);
    setUploadMsg(`Subiendo ${valid.length} archivo(s)...`);
    setUploadError(false);

    const formData = new FormData();
    valid.forEach(f => formData.append('files', f));

    try {
      const res = await fetch(`/api/kiosks/${id}/items/upload`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error subiendo');
      setUploadMsg(`${valid.length} archivo(s) subido(s) correctamente`);
      setUploadError(false);
      await fetchKiosk();
      setTimeout(() => setUploadMsg(''), 4000);
    } catch (e) {
      setUploadMsg('Error: ' + e.message);
      setUploadError(true);
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
    const dur = Math.max(1, Math.min(300, parseInt(val, 10) || 5));
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

  async function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex(i => i.id === active.id);
    const newIndex = items.findIndex(i => i.id === over.id);
    const reordered = arrayMove(items, oldIndex, newIndex);
    setItems(reordered);

    try {
      await fetch(`/api/kiosks/${id}/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: reordered.map(i => i.id) }),
      });
    } catch (e) {
      console.error('Reorder error:', e);
    }
  }

  function openPreview(index) {
    setPreviewIndex(index);
    setModalOpen(true);
  }

  async function openExistingMedia() {
    setExistingOpen(true);
    setExistingLoading(true);
    setExistingMsg('');
    setSelectedExisting([]);
    try {
      const res = await fetch(`/api/kiosks/${id}/media-library`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error cargando biblioteca');
      setExistingItems(data);
    } catch (e) {
      setExistingMsg('Error: ' + e.message);
    } finally {
      setExistingLoading(false);
    }
  }

  function toggleExistingSelection(itemId) {
    setSelectedExisting(prev =>
      prev.includes(itemId)
        ? prev.filter(idValue => idValue !== itemId)
        : [...prev, itemId],
    );
  }

  async function addExistingMedia() {
    if (selectedExisting.length === 0) return;
    setExistingLoading(true);
    setExistingMsg('');
    try {
      const res = await fetch(`/api/kiosks/${id}/items/from-existing`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: selectedExisting }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error agregando contenido');
      await fetchKiosk();
      setExistingMsg(`${data.inserted.length} elemento(s) agregado(s)`);
      setSelectedExisting([]);
      setExistingOpen(false);
    } catch (e) {
      setExistingMsg('Error: ' + e.message);
    } finally {
      setExistingLoading(false);
    }
  }

  function handleExistingOverlayMouseDown(e) {
    if (e.target === e.currentTarget) {
      setExistingOpen(false);
    }
  }

  const breadcrumbs = kiosk
    ? [{ label: 'Kioskos', to: '/admin' }, { label: kiosk.name }]
    : [{ label: 'Kioskos', to: '/admin' }, { label: 'Cargando...' }];

  if (loading) {
    return (
      <AdminLayout breadcrumbs={[{ label: 'Kioskos', to: '/admin' }, { label: '...' }]}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', padding: '32px 0' }}>
          <Loader2 size={18} className="spin" />
          <span>Cargando kiosko...</span>
        </div>
      </AdminLayout>
    );
  }

  if (error) {
    return (
      <AdminLayout breadcrumbs={[{ label: 'Kioskos', to: '/admin' }]}>
        <div className="alert alert-error">
          <AlertCircle size={14} />
          {error}
        </div>
        <Link to="/admin" className="btn btn-ghost">Volver al dashboard</Link>
      </AdminLayout>
    );
  }

  const publicUrl = `${window.location.origin}/${kiosk.slug}`;
  const totalItems = items.length;
  const enabledItems = items.filter(i => i.enabled).length;
  const disabledItems = totalItems - enabledItems;

  return (
    <AdminLayout breadcrumbs={breadcrumbs}>

      {/* Configuration card */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header" style={{ marginBottom: 16 }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>Configuración del kiosko</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SaveStatus saving={saving} saveMsg={saveMsg} />
            <a href={publicUrl} target="_blank" rel="noreferrer" className="btn btn-ghost btn-sm">
              <ExternalLink size={13} />
              Vista pública
            </a>
          </div>
        </div>

        <form onSubmit={handleSaveKiosk}>
          <div className="kiosk-config-grid">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="kiosk-name">Nombre</label>
              <input
                id="kiosk-name"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Nombre del kiosko"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="kiosk-slug">Slug (URL)</label>
              <input
                id="kiosk-slug"
                type="text"
                value={slug}
                onChange={e => setSlug(e.target.value)}
                placeholder="slug-url"
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="kiosk-orientation">Orientación</label>
              <select
                id="kiosk-orientation"
                value={orientation}
                onChange={e => setOrientation(e.target.value)}
              >
                <option value="portrait">Vertical 9:16 (1080×1920)</option>
                <option value="landscape">Horizontal 16:9 (1920×1080)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="kiosk-fit-mode">Ajuste</label>
              <select
                id="kiosk-fit-mode"
                value={fitMode}
                onChange={e => setFitMode(e.target.value)}
              >
                <option value="cover">Rellenar pantalla</option>
                <option value="contain">Mostrar completo</option>
              </select>
            </div>
          </div>

          <div className="url-preview" style={{ marginTop: 14 }}>
            <span className="url-preview-label">URL pública:</span>
            <a href={publicUrl} target="_blank" rel="noreferrer">{publicUrl}</a>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 16 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', userSelect: 'none' }}>
              {enabled
                ? <ToggleRight size={22} style={{ color: 'var(--success)' }} />
                : <ToggleLeft size={22} style={{ color: 'var(--text-faint)' }} />
              }
              <input
                type="checkbox"
                checked={enabled}
                onChange={e => setEnabled(e.target.checked)}
                style={{ display: 'none' }}
              />
              <span style={{ fontSize: 13 }}>
                Kiosko {enabled ? 'activo (visible públicamente)' : 'inactivo (oculto)'}
              </span>
            </label>

            <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginLeft: 'auto' }}>
              {saving ? <><Loader2 size={14} className="spin" /> Guardando</> : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </div>

      {/* Upload zone */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="section-header" style={{ marginBottom: 14 }}>
          <h3 className="card-title" style={{ marginBottom: 0 }}>Subir archivos</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={openExistingMedia}>
            Agregar existente
          </button>
        </div>
        <div
          className={`drop-zone${dragOver ? ' drag-over' : ''}`}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          role="button"
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && fileInputRef.current?.click()}
          aria-label="Zona de carga de archivos"
        >
          <div className="drop-zone-icon">
            <Upload size={36} />
          </div>
          <p>Arrastra imágenes o videos aquí, o haz clic para seleccionar</p>
          <p style={{ fontSize: 12, marginTop: 4 }}>JPG, PNG, GIF, WEBP, MP4, WEBM, MOV — Máx. 200 MB por archivo</p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={e => uploadFiles(e.target.files)}
        />
        {uploadMsg && (
          <div className={`upload-progress${uploadError ? '' : ''}`} style={{ color: uploadError ? 'var(--danger)' : 'var(--text-muted)' }}>
            {uploading
              ? <Loader2 size={14} className="spin" />
              : uploadError
                ? <XCircle size={14} />
                : <CheckCircle size={14} style={{ color: 'var(--success)' }} />
            }
            {uploadMsg}
          </div>
        )}
      </div>

      {/* Playlist */}
      <div className="card">
        <div className="section-header">
          <div>
            <h3 className="card-title" style={{ marginBottom: 4 }}>
              <List size={16} style={{ display: 'inline', marginRight: 6, verticalAlign: 'middle' }} />
              Playlist
            </h3>
            {totalItems > 0 && (
              <div className="playlist-stats">
                <span className="playlist-stat">
                  {totalItems} elemento{totalItems !== 1 ? 's' : ''}
                </span>
                <span className="playlist-stat" style={{ color: 'var(--success)' }}>
                  <Eye size={12} />
                  {enabledItems} activo{enabledItems !== 1 ? 's' : ''}
                </span>
                {disabledItems > 0 && (
                  <span className="playlist-stat" style={{ color: 'var(--text-faint)' }}>
                    {disabledItems} desactivado{disabledItems !== 1 ? 's' : ''}
                  </span>
                )}
              </div>
            )}
          </div>
          {items.length > 0 && (
            <a
              href={`/${kiosk.slug}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-ghost btn-sm"
            >
              <ExternalLink size={13} />
              Previsualizar
            </a>
          )}
        </div>

        {items.length === 0 ? (
          <div className="empty-state" style={{ padding: '32px 24px' }}>
            <div className="empty-state-icon"><Upload size={32} /></div>
            <p>Sin elementos. Sube imágenes o videos arriba para comenzar.</p>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={items.map(i => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="items-list">
                {items.map((item, index) => (
                  <SortablePlaylistItem
                    key={item.id}
                    item={item}
                    index={index}
                    total={items.length}
                    onDelete={handleDeleteItem}
                    onToggle={handleToggleItem}
                    onDurationChange={handleDuration}
                    onPreview={() => openPreview(index)}
                    localDuration={durationEdits[item.id]}
                    onDurationEdit={(itemId, val) =>
                      setDurationEdits(prev => ({ ...prev, [itemId]: val }))
                    }
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>

      {/* Media viewer modal */}
      {modalOpen && items.length > 0 && (
        <MediaModal
          items={items}
          currentIndex={previewIndex}
          onClose={() => setModalOpen(false)}
          onNavigate={setPreviewIndex}
        />
      )}

      {existingOpen && (
        <div className="modal-overlay" onMouseDown={handleExistingOverlayMouseDown} role="presentation">
          <div className="modal existing-media-modal">
            <div className="section-header" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 0 }}>Agregar contenido existente</h3>
              <button
                type="button"
                className="btn-icon"
                onClick={() => setExistingOpen(false)}
                aria-label="Cerrar"
              >
                <X size={16} />
              </button>
            </div>

            {existingLoading && (
              <div className="upload-progress">
                <Loader2 size={14} className="spin" />
                Cargando...
              </div>
            )}

            {existingMsg && (
              <div className={`alert ${existingMsg.startsWith('Error') ? 'alert-error' : 'alert-success'}`}>
                {existingMsg}
              </div>
            )}

            {!existingLoading && existingItems.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <p>No hay contenido disponible en otros kioskos.</p>
              </div>
            ) : (
              <div className="existing-media-list">
                {existingItems.map(item => {
                  const selected = selectedExisting.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`existing-media-row${selected ? ' selected' : ''}`}
                      onClick={() => toggleExistingSelection(item.id)}
                    >
                      {item.type === 'image' ? (
                        <img src={`/uploads${item.filePath}`} alt="" className="existing-media-thumb" />
                      ) : (
                        <div className="existing-media-thumb existing-media-video">VID</div>
                      )}
                      <span className="existing-media-info">
                        <span className="existing-media-name">{item.originalName}</span>
                        <span className="existing-media-source">{item.sourceKioskName}</span>
                      </span>
                      <span className="existing-media-check">{selected ? 'Seleccionado' : 'Agregar'}</span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setExistingOpen(false)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={addExistingMedia}
                disabled={selectedExisting.length === 0 || existingLoading}
              >
                Agregar {selectedExisting.length || ''} seleccionado{selectedExisting.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
