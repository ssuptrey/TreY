// ============================================
// LAYOUT COMPONENT
// ============================================
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async (): Promise<void> => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout-container">
      {/* Enforcement notice (top banner) */}
      <div className="enforcement-banner">
        <strong>SYSTEM OF RECORD</strong> - All actions are logged and strictly immutable.
      </div>

      <div className="layout-body">
        {/* Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <h2>TreY</h2>
            <div className="org-badge">{user?.organization_name || 'Acme Corp'}</div>
          </div>

          <nav className="sidebar-nav">
            <div className="nav-section-title">Overview</div>
            <ul>
              <li>
                <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  Dashboard
                </NavLink>
              </li>
              <li>
                <NavLink to="/inbox" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  Unified Inbox
                </NavLink>
              </li>
              <li>
                <NavLink to="/my-tasks" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  My Tasks
                </NavLink>
              </li>
            </ul>

            <div className="nav-section-title" style={{ marginTop: '24px' }}>Compliance</div>
            <ul>
              <li>
                <NavLink to="/register" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  Obligation Register
                </NavLink>
              </li>
              <li>
                <NavLink to="/obligations" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  Obligations
                </NavLink>
              </li>
              <li>
                <NavLink to="/evidence" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  Evidence Library
                </NavLink>
              </li>
              <li>
                <NavLink to="/ingestion" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
                  Ingestion Center
                </NavLink>
              </li>
            </ul>
          </nav>

          <div className="sidebar-footer">
            <div className="user-profile">
              <div className="user-avatar">{user?.name?.charAt(0) || 'U'}</div>
              <div className="user-info">
                <div className="user-name">{user?.name}</div>
                <div className="user-role">{user?.role}</div>
              </div>
            </div>
            <button className="btn-logout" onClick={handleLogout}>
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="main-wrapper">
          <header className="top-header">
            <div className="header-breadcrumbs">
              <span className="breadcrumb-text">Compliance Workspace</span>
            </div>
          </header>
          
          <main className="main-content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Layout;
