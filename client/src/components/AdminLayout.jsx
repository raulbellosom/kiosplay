import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Wrench, Monitor, X, Menu } from 'lucide-react';

const NAV_LINKS = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/tools', label: 'Herramientas', icon: Wrench, exact: false },
];

function LogoIcon() {
  return (
    <div className="admin-sidebar-logo">
      <Monitor size={16} />
    </div>
  );
}

export default function AdminLayout({ children, breadcrumbs }) {
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  function isActive(link) {
    return link.exact
      ? location.pathname === link.to
      : location.pathname.startsWith(link.to);
  }

  const navLinks = NAV_LINKS.map(link => (
    <Link
      key={link.to}
      to={link.to}
      className={`admin-nav-link${isActive(link) ? ' active' : ''}`}
      onClick={() => setDrawerOpen(false)}
    >
      <link.icon size={16} />
      {link.label}
    </Link>
  ));

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="admin-sidebar">
        <Link to="/admin" className="admin-sidebar-brand">
          <LogoIcon />
          <span className="admin-sidebar-title">PVRInfo</span>
        </Link>
        <nav className="admin-sidebar-nav">
          {navLinks}
        </nav>
        <div className="admin-sidebar-footer">
          Digital Signage
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="admin-topbar">
        <Link to="/admin" className="admin-topbar-brand">
          <LogoIcon />
          <span className="admin-topbar-title">PVRInfo</span>
        </Link>
        <button
          className="hamburger-btn"
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir menú"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Mobile drawer */}
      <div
        className={`admin-drawer-overlay${drawerOpen ? ' open' : ''}`}
        onClick={() => setDrawerOpen(false)}
      />
      <div className={`admin-drawer${drawerOpen ? ' open' : ''}`} role="dialog" aria-modal="true">
        <button
          className="admin-drawer-close"
          onClick={() => setDrawerOpen(false)}
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
        <Link to="/admin" className="admin-sidebar-brand" style={{ marginTop: 8 }}>
          <LogoIcon />
          <span className="admin-sidebar-title">PVRInfo</span>
        </Link>
        <nav className="admin-sidebar-nav" style={{ paddingTop: 8 }}>
          {navLinks}
        </nav>
      </div>

      {/* Main content */}
      <div className="admin-content">
        <main className="admin-main">
          {breadcrumbs && breadcrumbs.length > 0 && (
            <nav className="breadcrumb" aria-label="Breadcrumb">
              {breadcrumbs.map((crumb, i) => {
                const isLast = i === breadcrumbs.length - 1;
                return (
                  <React.Fragment key={i}>
                    {i > 0 && <span className="breadcrumb-sep">/</span>}
                    {isLast
                      ? <span className="breadcrumb-current">{crumb.label}</span>
                      : <Link to={crumb.to}>{crumb.label}</Link>
                    }
                  </React.Fragment>
                );
              })}
            </nav>
          )}
          {children}
        </main>
      </div>
    </>
  );
}
