import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function AdminDashboard() {
  const [kiosks, setKiosks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
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
        body: JSON.stringify({ name: newName.trim(), slug: newSlug.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando kiosko');
      setShowCreate(false);
      setNewName('');
      setNewSlug('');
      navigate(`/admin/kiosk/${data.id}`);
    } catch (e) {
      setCreateError(e.message);
    } finally {
      setCreating(false);
    }
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

  function formatDate(str) {
    return new Date(str).toLocaleDateString('es-MX', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }

  return (
    <div className="admin-layout">
      <header className="admin-header">
        <span className="logo">◉</span>
        <h1>PVRInfo — Panel de Administración</h1>
      </header>

      <main className="admin-main">
        <div className="section-header">
          <h2>Kioskos</h2>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link to="/admin/tools" className="btn btn-ghost">
              Herramientas
            </Link>
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Nuevo kiosko
            </button>
          </div>
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <p style={{ color: 'var(--text-muted)' }}>Cargando...</p>
        ) : kiosks.length === 0 ? (
          <div className="empty-state">
            <h3>Sin kioskos</h3>
            <p>Crea tu primer kiosko para empezar.</p>
          </div>
        ) : (
          <div className="kiosk-grid">
            {kiosks.map(k => (
              <div key={k.id} className="kiosk-card">
                <div className="kiosk-card-header">
                  <div>
                    <div className="kiosk-card-title">{k.name}</div>
                    <div className="kiosk-card-slug">/{k.slug}</div>
                  </div>
                  <span className={`badge ${k.enabled ? 'badge-active' : 'badge-inactive'}`}>
                    {k.enabled ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  Creado {formatDate(k.createdAt)}
                </div>
                <div className="kiosk-card-actions">
                  <Link
                    to={`/admin/kiosk/${k.id}`}
                    className="btn btn-ghost btn-sm"
                  >
                    Editar
                  </Link>
                  <a
                    href={`/${k.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-ghost btn-sm"
                  >
                    Ver
                  </a>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleDelete(k)}
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal crear kiosko */}
      {showCreate && (
        <div className="modal-overlay" onClick={() => setShowCreate(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h3>Nuevo kiosko</h3>
            {createError && <div className="alert alert-error">{createError}</div>}
            <form onSubmit={handleCreate}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  type="text"
                  placeholder="Ej: Recepción"
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label>Slug (URL)</label>
                <input
                  type="text"
                  placeholder="Ej: recepcion (se genera automático)"
                  value={newSlug}
                  onChange={e => setNewSlug(e.target.value)}
                />
                <span className="form-hint">
                  Solo letras, números y guiones. Si lo dejas vacío se genera desde el nombre.
                </span>
              </div>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => setShowCreate(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={creating}>
                  {creating ? 'Creando...' : 'Crear'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
