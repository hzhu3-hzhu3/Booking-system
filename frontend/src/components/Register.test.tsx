import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Register } from './Register';

describe('Register Component', () => {
  it('renders registration form with all required fields', () => {
    const mockRegister = vi.fn();
    const mockSwitch = vi.fn();
    
    render(<Register onRegister={mockRegister} onSwitchToLogin={mockSwitch} />);
    
    expect(screen.getByPlaceholderText(/email address/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/^password$/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/confirm password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /register/i })).toBeInTheDocument();
  });

  it('validates password minimum length', async () => {
    const mockRegister = vi.fn();
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Register onRegister={mockRegister} onSwitchToLogin={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const submitButton = screen.getByRole('button', { name: /register/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, '12345');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/password must be at least 6 characters/i)).toBeInTheDocument();
    });
    
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('validates passwords match', async () => {
    const mockRegister = vi.fn();
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Register onRegister={mockRegister} onSwitchToLogin={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password456');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('submits form with valid data', async () => {
    const mockRegister = vi.fn().mockResolvedValue(undefined);
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Register onRegister={mockRegister} onSwitchToLogin={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });

  it('displays error message on registration failure', async () => {
    const mockRegister = vi.fn().mockRejectedValue({
      response: {
        data: {
          error: {
            message: 'Email already exists',
          },
        },
      },
    });
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Register onRegister={mockRegister} onSwitchToLogin={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('disables submit button while loading', async () => {
    const mockRegister = vi.fn(() => new Promise<void>(() => {})); // Never resolves
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Register onRegister={mockRegister} onSwitchToLogin={mockSwitch} />);
    
    const emailInput = screen.getByPlaceholderText(/email address/i);
    const passwordInput = screen.getByPlaceholderText(/^password$/i);
    const confirmPasswordInput = screen.getByPlaceholderText(/confirm password/i);
    const submitButton = screen.getByRole('button', { name: /register/i });
    
    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.type(confirmPasswordInput, 'password123');
    await user.click(submitButton);
    
    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(screen.getByText(/creating account/i)).toBeInTheDocument();
    });
  });

  it('switches to login view when sign in link is clicked', async () => {
    const mockRegister = vi.fn();
    const mockSwitch = vi.fn();
    const user = userEvent.setup();
    
    render(<Register onRegister={mockRegister} onSwitchToLogin={mockSwitch} />);
    
    const loginLink = screen.getByText(/already have an account\? sign in/i);
    await user.click(loginLink);
    
    expect(mockSwitch).toHaveBeenCalled();
  });
});
