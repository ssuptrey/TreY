import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import { authAPI } from '../api';

jest.mock('../api', () => ({
  authAPI: {
    me: jest.fn(),
    login: jest.fn(),
    register: jest.fn()
  }
}));

const TestComponent = () => {
  const { user, loading, login, logout, register } = useAuth();
  if (loading) return <div data-testid="loading">Loading...</div>;
  return (
    <div>
      <div data-testid="user-status">{user ? 'Logged in: ' + user.name : 'Not logged in'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => register({ name: 'Test', email: 'test@example.com', password: 'password', role: 'INTERNAL_TEAM' })}>Register</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  it('fetches user on mount if token exists', async () => {
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test Owner' }));
    
    // Explicitly return a resolved promise to simulate successful token validation
    (authAPI.me as jest.Mock).mockResolvedValue({ 
      data: { 
        id: 1, 
        name: 'Test Owner', 
        email: 'test@example.com', 
        role: 'INTERNAL_TEAM' 
      } 
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    expect(screen.getByTestId('loading')).toBeInTheDocument();
    
    // Wait for loading to clear, then check status
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
    
    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in: Test Owner');
    });
  });

  it('stays logged out if no token exists', async () => {
    (authAPI.me as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // After resolving mounting, should be not logged in
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });
  });

  it('handles login properly', async () => {
    (authAPI.me as jest.Mock).mockRejectedValue(new Error('Unauthorized')); // initial load fails
    (authAPI.login as jest.Mock).mockResolvedValue({
      data: {
        token: 'new-token',
        user: { id: 1, name: 'New User' }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // wait for initial load to finish
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Login'));

    await waitFor(() => {
      expect(authAPI.login).toHaveBeenCalledWith('test@example.com', 'password');
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in: New User');
      expect(localStorage.getItem('token')).toBe('new-token');
    });
  });

  it('handles logout perfectly', async () => {
    localStorage.setItem('token', 'fake-token');
    localStorage.setItem('user', JSON.stringify({ id: 1, name: 'Test Owner' }));
    (authAPI.me as jest.Mock).mockResolvedValue({ data: { id: 1, name: 'Test Owner' } });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    // wait until loaded
    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Logout'));

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  it('handles register correctly', async () => {
    (authAPI.me as jest.Mock).mockRejectedValue(new Error('Unauthorized'));
    (authAPI.register as jest.Mock).mockResolvedValue({
      data: {
        token: 'reg-token',
        user: { id: 2, name: 'Test' }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Register'));

    await waitFor(() => {
      expect(authAPI.register).toHaveBeenCalledWith({
        name: 'Test', email: 'test@example.com', password: 'password', role: 'INTERNAL_TEAM'
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in: Test');
      expect(localStorage.getItem('token')).toBe('reg-token');
    });
  });
});
