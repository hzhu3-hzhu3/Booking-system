import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchPanel } from './SearchPanel';
import type { RuleConfig } from '../types';

const mockRules: RuleConfig = {
  id: 1,
  openHour: 8,
  closeHour: 22,
  timeSlotIntervalMinutes: 15,
  minDurationMinutes: 30,
  maxDurationMinutes: 120,
  maxActiveBookings: 3,
  minNoticeMinutes: 30,
  maxDaysAhead: 14,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('SearchPanel', () => {
  it('renders all form fields', () => {
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    expect(screen.getByLabelText(/date/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/start time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/end time/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/minimum capacity/i)).toBeInTheDocument();
    expect(screen.getByText(/equipment/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /search rooms/i })).toBeInTheDocument();
  });

  it('displays booking rules when provided', () => {
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    expect(screen.getByText(/booking rules/i)).toBeInTheDocument();
    expect(screen.getByText(/operating hours: 8:00 - 22:00/i)).toBeInTheDocument();
    expect(screen.getByText(/duration: 30-120 minutes/i)).toBeInTheDocument();
    expect(screen.getByText(/15-minute intervals/i)).toBeInTheDocument();
  });

  it('generates time options in 15-minute intervals', () => {
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    const startTimeSelect = screen.getByLabelText(/start time/i) as HTMLSelectElement;
    const options = Array.from(startTimeSelect.options).map(opt => opt.value);

    expect(options).toContain('08:00');
    expect(options).toContain('08:15');
    expect(options).toContain('08:30');
    expect(options).toContain('08:45');
    expect(options).toContain('09:00');
  });

  it('submits search with valid criteria', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    const dateInput = screen.getByLabelText(/date/i);
    const startTimeSelect = screen.getByLabelText(/start time/i);
    const endTimeSelect = screen.getByLabelText(/end time/i);
    const capacityInput = screen.getByLabelText(/minimum capacity/i);
    const submitButton = screen.getByRole('button', { name: /search rooms/i });

    await user.clear(dateInput);
    await user.type(dateInput, '2026-01-25');
    await user.selectOptions(startTimeSelect, '09:00');
    await user.selectOptions(endTimeSelect, '10:00');
    await user.type(capacityInput, '4');

    await user.click(submitButton);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith({
        date: expect.any(Date),
        startTime: '09:00',
        endTime: '10:00',
        minCapacity: 4,
        equipmentTags: undefined,
      });
    });
  });

  it('handles equipment selection', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    const projectorCheckbox = screen.getByRole('checkbox', { name: /projector/i });
    const whiteboardCheckbox = screen.getByRole('checkbox', { name: /whiteboard/i });

    await user.click(projectorCheckbox);
    await user.click(whiteboardCheckbox);

    expect(projectorCheckbox).toBeChecked();
    expect(whiteboardCheckbox).toBeChecked();

    const submitButton = screen.getByRole('button', { name: /search rooms/i });
    await user.click(submitButton);

    await waitFor(() => {
      expect(onSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          equipmentTags: expect.arrayContaining(['Projector', 'Whiteboard']),
        })
      );
    });
  });

  it('allows removing selected equipment tags', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    const projectorCheckbox = screen.getByRole('checkbox', { name: /projector/i });
    await user.click(projectorCheckbox);

    // Find the tag badge with Projector text
    const projectorBadges = screen.getAllByText('Projector');
    expect(projectorBadges.length).toBeGreaterThan(0);

    // Find the remove button within the badge
    const removeButtons = screen.getAllByRole('button', { name: '×' });
    await user.click(removeButtons[0]);

    expect(projectorCheckbox).not.toBeChecked();
  });

  it('validates that end time is after start time', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    const startTimeSelect = screen.getByLabelText(/start time/i);
    const endTimeSelect = screen.getByLabelText(/end time/i);

    // Select a valid end time first
    await user.selectOptions(startTimeSelect, '09:00');
    await user.selectOptions(endTimeSelect, '10:00');
    
    // Now change start time to be after end time
    await user.selectOptions(startTimeSelect, '11:00');

    // The component should clear the end time automatically via useEffect
    // Try to submit without selecting a new end time
    const submitButton = screen.getByRole('button', { name: /search rooms/i });
    await user.click(submitButton);

    // Should show validation error for required end time
    await waitFor(() => {
      const errorMessage = screen.queryByText(/end time must be after start time/i) || 
                          screen.queryByText(/end time is required/i);
      expect(errorMessage).toBeInTheDocument();
    });

    expect(onSearch).not.toHaveBeenCalled();
  });

  it('disables submit button when loading', () => {
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={true} rules={mockRules} />);

    const submitButton = screen.getByRole('button', { name: /searching/i });
    expect(submitButton).toBeDisabled();
  });

  it('validates minimum capacity is positive', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();
    render(<SearchPanel onSearch={onSearch} isLoading={false} rules={mockRules} />);

    const capacityInput = screen.getByLabelText(/minimum capacity/i);
    
    // HTML5 validation will prevent typing 0 in a number input with min="1"
    // But we can test by directly setting the value
    fireEvent.change(capacityInput, { target: { value: '0' } });

    const submitButton = screen.getByRole('button', { name: /search rooms/i });
    await user.click(submitButton);

    // The browser's HTML5 validation should prevent submission
    // In a real browser, this would show a validation message
    // In jsdom, we need to check if the form validation works
    expect(onSearch).not.toHaveBeenCalled();
  });
});
