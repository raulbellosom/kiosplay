import React from 'react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      color: 'var(--text-muted)',
    }}>
      <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--text)' }}>404</div>
      <p>Página no encontrada</p>
      <Link to="/admin" className="btn btn-ghost">Ir al panel de administración</Link>
    </div>
  );
}
