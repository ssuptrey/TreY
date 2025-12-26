// ============================================
// AUTH CONTEXT TESTS
// ============================================
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider, useAuth } from './AuthContext';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Test component that uses auth context
const TestComponent: React.FC = () => {
  const { user, loading, login, logout } = useAuth();
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <div data-testid="user-status">{user ? `Logged in as ${user.email}` : 'Not logged in'}</div>
      <button onClick={() => login('test@example.com', 'password')}>Login</button>
      <button onClick={logout}>Logout</button>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('provides initial unauthenticated state', async () => {
    mockedAxios.get.mockRejectedValue(new Error('Not authenticated'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
    });
  });

  test('loads user from token on mount', async () => {
    localStorage.setItem('token', 'fake-token');
    
    mockedAxios.get.mockResolvedValue({
      data: {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User'
        }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });
  });

  test('handles login successfully', async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        token: 'new-token',
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User'
        }
      }
    });

    mockedAxios.get.mockResolvedValue({
      data: {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User'
        }
      }
    });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    const loginButton = screen.getByText('Login');
    loginButton.click();

    await waitFor(() => {
      expect(localStorage.getItem('token')).toBe('new-token');
    });
  });

  test('handles logout', async () => {
    localStorage.setItem('token', 'fake-token');
    
    mockedAxios.get.mockResolvedValue({
      data: {
        user: {
          id: '1',
          email: 'test@example.com',
          name: 'Test User'
        }
      }
    });

    mockedAxios.post.mockResolvedValue({ data: { message: 'Logged out' } });

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Logged in as test@example.com');
    });

    const logoutButton = screen.getByText('Logout');
    logoutButton.click();

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });

  test('clears user on API error during initial load', async () => {
    localStorage.setItem('token', 'expired-token');
    mockedAxios.get.mockRejectedValue(new Error('Token expired'));

    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId('user-status')).toHaveTextContent('Not logged in');
      expect(localStorage.getItem('token')).toBeNull();
    });
  });
});
