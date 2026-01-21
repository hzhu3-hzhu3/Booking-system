import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AuthProvider } from './AuthContext';
import { useAuth } from '../hooks';
import { api, apiClient } from '../services/api';

// Mock the API
vi.mock('../services/api', () => ({
  api: {
    post: vi.fn(),
  },
  apiClient: {
    setAuthToken: vi.fn(),
    clearAuthToken: vi.fn(),
    getAuthToken: vi.fn(),
  },
}));

// Test component that uses the auth context
function TestComponent() {
  const { user, isAuthenticated, isLoading, login, register, logout } = useAuth();
  
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="authenticated">{isAuthenticated ? 'yes' : 'no'}</div>
      <div data-testid="user">{user ? user.email : 'none'}</div>
      <button onClick={() => login({ email: 'test@example.com', password: 'password' })}>
        Login
      </button>
      <button onClick={() => register({ email: 'new@example.com', password: 'password' })}>
        Register
      </button>
      <button onClick={logout}>Logout</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes with no user when no token exists', async () => {
    vi.mocked(apiClient.getAuthToken).mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
    
    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    expect(screen.getByTestId('user')).toHaveTextContent('none');
  });

  it('restores user from localStorage on mount', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'user' as const };
    
    vi.mocked(apiClient.getAuthToken).mockReturnValue('mock-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
    
    expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
  });

  it('stores token and user in localStorage on successful login', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'user' as const };
    const mockResponse = {
      data: {
        token: 'new-token',
        user: mockUser,
      },
    };
    
    vi.mocked(api.post).mockResolvedValue(mockResponse);
    vi.mocked(apiClient.getAuthToken).mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
    
    const loginButton = screen.getByText('Login');
    loginButton.click();
    
    await waitFor(() => {
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('new-token');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      expect(screen.getByTestId('user')).toHaveTextContent('test@example.com');
    });
    
    // Verify localStorage was updated
    const storedUser = localStorage.getItem('user');
    expect(storedUser).toBeTruthy();
    expect(JSON.parse(storedUser!)).toEqual(mockUser);
  });

  it('stores token and user in localStorage on successful registration', async () => {
    const mockUser = { id: '2', email: 'new@example.com', role: 'user' as const };
    const mockResponse = {
      data: {
        token: 'registration-token',
        user: mockUser,
      },
    };
    
    vi.mocked(api.post).mockResolvedValue(mockResponse);
    vi.mocked(apiClient.getAuthToken).mockReturnValue(null);
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
    
    const registerButton = screen.getByText('Register');
    registerButton.click();
    
    await waitFor(() => {
      expect(apiClient.setAuthToken).toHaveBeenCalledWith('registration-token');
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
      expect(screen.getByTestId('user')).toHaveTextContent('new@example.com');
    });
    
    // Verify localStorage was updated
    const storedUser = localStorage.getItem('user');
    expect(storedUser).toBeTruthy();
    expect(JSON.parse(storedUser!)).toEqual(mockUser);
  });

  it('clears token and user on logout', async () => {
    const mockUser = { id: '1', email: 'test@example.com', role: 'user' as const };
    
    vi.mocked(apiClient.getAuthToken).mockReturnValue('mock-token');
    localStorage.setItem('user', JSON.stringify(mockUser));
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('authenticated')).toHaveTextContent('yes');
    });
    
    const logoutButton = screen.getByText('Logout');
    logoutButton.click();
    
    await waitFor(() => {
      expect(apiClient.clearAuthToken).toHaveBeenCalled();
      expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
      expect(screen.getByTestId('user')).toHaveTextContent('none');
    });
  });

  it('handles corrupted localStorage data gracefully', async () => {
    vi.mocked(apiClient.getAuthToken).mockReturnValue('mock-token');
    localStorage.setItem('user', 'invalid-json');
    
    // Mock console.error to avoid noise in test output
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    render(
      <AuthProvider>
        <TestComponent />
      </AuthProvider>
    );
    
    await waitFor(() => {
      expect(screen.getByTestId('loading')).toHaveTextContent('ready');
    });
    
    expect(screen.getByTestId('authenticated')).toHaveTextContent('no');
    expect(apiClient.clearAuthToken).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();
    
    consoleErrorSpy.mockRestore();
  });
});
