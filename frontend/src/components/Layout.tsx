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
    <div className="layout">
      {/* Enforcement notice */}
      <div className="enforcement-notice">
        <strong>SYSTEM OF RECORD</strong> - All actions are logged. Data is immutable. Evidence timestamps cannot be altered.
      </div>

      {/* Header */}
      <header className="header">
        <h1>Compliance Execution System</h1>
        <div className="header-info">
          <span>{user?.organization_name}</span>
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
            <NavLink to="/inbox" className={({ isActive }) => isActive ? 'active' : ''}>
              Unified Inbox
            </NavLink>
          </li>
          <li>
            <NavLink to="/my-tasks" className={({ isActive }) => isActive ? 'active' : ''}>
              My Tasks
            </NavLink>
          </li>
          <li>
            <NavLink to="/register" className={({ isActive }) => isActive ? 'active' : ''}>
              Obligation Register
            </NavLink>
          </li>
          <li>
            <NavLink to="/obligations" className={({ isActive }) => isActive ? 'active' : ''}>
              Obligations
            </NavLink>
          </li>
          <li>
            <NavLink to="/evidence" className={({ isActive }) => isActive ? 'active' : ''}>
              Evidence Library
            </NavLink>
          </li>
          <li>
            <NavLink to="/ingestion" className={({ isActive }) => isActive ? 'active' : ''}>
              Ingestion Center
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
};

export default Layout;
