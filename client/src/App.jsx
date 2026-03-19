import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import AdminKioskEdit from './pages/AdminKioskEdit';
import KioskView from './pages/KioskView';
import Tools from './pages/Tools';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Routes>
      {/* Panel de administración */}
      <Route path="/admin" element={<AdminDashboard />} />
      <Route path="/admin/kiosk/:id" element={<AdminKioskEdit />} />
      <Route path="/admin/tools" element={<Tools />} />

      {/* Ruta raíz redirige al admin */}
      <Route path="/" element={<Navigate to="/admin" replace />} />

      {/* Kioskos públicos por slug */}
      <Route path="/:slug" element={<KioskView />} />

      {/* 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
