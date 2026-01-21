import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from './Login';

describe('Login Component', () => {
  it('renders login form with email and password fields', () => {
    const mockLogin = vi.fn();
    const mockSwitch = vi.fn();
    
    render(<Login onLogin={mockLogin} onSwitchToRegister={mockSwitch} />);
    
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('validates password is required', async () => {
    const mockLogin = vi.fn();
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Login onLogin={mockLogin} onSwitchToRegister={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/password is required/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('validates password minimum length', async () => {
    const mockLogin = vi.fn();
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Login onLogin={mockLogin} onSwitchToRegister={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, '12345');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    });
    
    expect(mockLogin).not.toHaveBeenCalled();
  });

  it('submits form with valid credentials', async () => {
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Login onLogin={mockLogin} onSwitchToRegister={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('displays error message on login failure', async () => {
    const mockLogin = vi.fn().mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Invalid credentials',
          },
        },
      },
    });
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Login onLogin={mockLogin} onSwitchToRegister={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const mockLogin = vi.fn(() => new Promise<void>(() => {})); // Never resolves
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Login onLogin={mockLogin} onSwitchToRegister={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/password/i);
    const submitButton = screen.getByRole('button', { name: /sign in/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/signing in/i)).toBeInTheDocument();
    });
  });

  it('switches to register view when register link is clicked', async () => {
    const mockLogin = vi.fn();
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Login onLogin={mockLogin} onSwitchToRegister={mockSwitch} />);
    
    const registerLink = screen.getByText(/don't have an account\? register/i);
    await user.click(registerLink);
    
    expect(mockSwitch).toHaveBeenCalled();
  });
});
