// ============================================
// LAYOUT COMPONENT
// ============================================
import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="layout">
      {/* Enforcement notice */}
      <div className="enforcement-notice">
        <strong>SYSTEM OF RECORD</strong> — All actions are logged. Data is immutable. Evidence timestamps cannot be altered.
      </div>

      {/* Header */}
      <header className="header">
        <h1>Compliance Execution System</h1>
        <div className="header-info">
          <span>{user?.organizationName}</span>
          <span>|</span>
          <span>{user?.name} ({user?.role})</span>
          <button className="btn btn-sm btn-outline" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav">
        <ul>
          <li>
            <NavLink to="/dashboard" className={({ isActive }) => isActive ? 'active' : ''}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/obligations" className={({ isActive }) => isActive ? 'active' : ''}>
              Obligations
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* Main content */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

export default Layout;
