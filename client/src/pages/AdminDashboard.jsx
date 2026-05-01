import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus, Edit2, ExternalLink, Trash2, Monitor, Smartphone,
  Tv2, FileImage, Loader2, AlertCircle, LayoutGrid,
} from 'lucide-react';
import AdminLayout from '../components/AdminLayout';

function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleDateString('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

export default function AdminDashboard() {
  const [kiosks, setKiosks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newOrientation, setNewOrientation] = useState('portrait');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const navigate = useNavigate();

  async function fetchKiosks() {
    try {
      const res = await fetch('/api/kiosks');
      if (!res.ok) throw new Error('Error cargando kioskos');
      setKiosks(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchKiosks(); }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    if (!newName.trim()) { setCreateError('El nombre es requerido'); return; }
    setCreating(true);
    try {
      const res = await fetch('/api/kiosks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim(), orientation: newOrientation }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando kiosko');
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      setNewOrientation('portrait');
      navigate(`/admin/kiosk/${data.id}`);
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
  }

  function closeCreate() {
    setShowCreate(false);
    setNewName('');
    setNewSlug('');
    setNewOrientation('portrait');
    setCreateError('');
  }

  async function handleDelete(kiosk) {
    if (!confirm(`¿Eliminar el kiosko "${kiosk.name}"? Se borrarán todos sus archivos.`)) return;
    try {
      const res = await fetch(`/api/kiosks/${kiosk.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error eliminando');
      fetchKiosks();
    } catch (e) {
      alert(e.message);
    }
  }

  const totalEnabled = kiosks.filter(k => k.enabled).length;

  return (
    <AdminLayout>
      {/* Page header */}
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700 }}>Kioskos</h2>
          {!loading && kiosks.length > 0 && (
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
              {kiosks.length} kiosko{kiosks.length !== 1 ? 's' : ''} · {totalEnabled} activo{totalEnabled !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          Nuevo kiosko
        </button>
      </div>

      {error && (
        <div className="alert alert-error">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', padding: '32px 0' }}>
          <Loader2 size={18} className="spin" />
          <span>Cargando kioskos...</span>
        </div>
      ) : kiosks.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon"><Tv2 size={48} /></div>
          <h3>Sin kioskos</h3>
          <p>Crea tu primer kiosko para comenzar a gestionar contenido.</p>
          <button className="btn btn-primary" onClick={() => setShowCreate(true)} style={{ marginTop: 8 }}>
            <Plus size={16} />
            Crear primer kiosko
          </button>
        </div>
      ) : (
        <div className="kiosk-grid">
          {kiosks.map(k => {
            const isPortrait = k.orientation !== 'landscape';
            const OrientIcon = isPortrait ? Smartphone : Monitor;
            const total = k.totalItems ?? 0;
            const enabled = k.enabledItems ?? 0;
            return (
              <div key={k.id} className="kiosk-card">
                <div className="kiosk-card-header">
                  <div style={{ minWidth: 0 }}>
                    <div className="kiosk-card-title">{k.name}</div>
                    <div className="kiosk-card-slug">/{k.slug}</div>
                  </div>
                  <span className={`badge ${k.enabled ? 'badge-active' : 'badge-inactive'}`}>
                    {k.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </div>

                {/* Stats row */}
                <div className="kiosk-card-stats">
                  <span className={`badge ${isPortrait ? 'badge-portrait' : 'badge-landscape'}`}>
                    <OrientIcon size={11} />
                    {isPortrait ? 'Vertical 9:16' : 'Horizontal 16:9'}
                  </span>
                  <span className="kiosk-card-stat">
                    <LayoutGrid size={12} />
                    {total} archivo{total !== 1 ? 's' : ''}
                  </span>
                  <span className="kiosk-card-stat">
                    <FileImage size={12} />
                    {enabled} activo{enabled !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="kiosk-card-meta">
                  Actualizado {formatDate(k.updatedAt || k.createdAt)}
                </div>

                <div className="kiosk-card-actions">
                  <Link to={`/admin/kiosk/${k.id}`} className="btn btn-primary btn-sm">
                    <Edit2 size={13} />
                    Editar
                  </Link>
                  <a
                    href={`/${k.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    <ExternalLink size={13} />
                    Ver
                  </a>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(k)}
                    style={{ marginLeft: 'auto' }}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create kiosk modal */}
      {showCreate && (
        <div className="modal-overlay" onClick={closeCreate}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Nuevo kiosko</h3>
            {createError && (
              <div className="alert alert-error">
                <AlertCircle size={14} />
                {createError}
              </div>
            )}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label htmlFor="new-kiosk-name">Nombre <span style={{ color: 'var(--danger)' }}>*</span></label>
                <input
                  id="new-kiosk-name"
                  type="text"
                  placeholder="Ej: Recepción"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label htmlFor="new-kiosk-slug">Slug (URL)</label>
                <input
                  id="new-kiosk-slug"
                  type="text"
                  placeholder="recepcion (se genera automático)"
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value)}
                />
                <span className="form-hint">Solo letras, números y guiones.</span>
              </div>
              <div className="form-group">
                <label htmlFor="new-kiosk-orientation">Orientación</label>
                <select
                  id="new-kiosk-orientation"
                  value={newOrientation}
                  onChange={e => setNewOrientation(e.target.value)}
                >
                  <option value="portrait">Vertical 9:16 (1080×1920)</option>
                  <option value="landscape">Horizontal 16:9 (1920×1080)</option>
                </select>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn btn-ghost" onClick={closeCreate}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? <><Loader2 size={14} className="spin" /> Creando...</> : 'Crear kiosko'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}
