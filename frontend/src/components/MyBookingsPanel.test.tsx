import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MyBookingsPanel } from './MyBookingsPanel';
import type { Booking } from '../types';

const mockBookings: Booking[] = [
  {
    id: '1',
    userId: 'user-1',
    roomId: 'room-1',
    roomName: 'Conference Room A',
    startAt: '2026-01-25T09:00:00Z',
    endAt: '2026-01-25T10:00:00Z',
    status: 'confirmed',
    createdAt: '2026-01-19T10:00:00Z',
    updatedAt: '2026-01-19T10:00:00Z',
  },
  {
    id: '2',
    userId: 'user-1',
    roomId: 'room-2',
    roomName: 'Meeting Room B',
    startAt: '2026-01-26T14:00:00Z',
    endAt: '2026-01-26T15:30:00Z',
    status: 'confirmed',
    createdAt: '2026-01-19T11:00:00Z',
    updatedAt: '2026-01-19T11:00:00Z',
  },
  {
    id: '3',
    userId: 'user-1',
    roomId: 'room-3',
    roomName: 'Study Room C',
    startAt: '2026-01-18T10:00:00Z',
    endAt: '2026-01-18T11:00:00Z',
    status: 'cancelled',
    cancelledAt: '2026-01-18T09:00:00Z',
    createdAt: '2026-01-18T08:00:00Z',
    updatedAt: '2026-01-18T09:00:00Z',
  },
];

describe('MyBookingsPanel', () => {
  it('renders the panel title', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={[]}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    expect(screen.getByText('My Bookings')).toBeInTheDocument();
  });

  it('displays loading state', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={undefined}
        isLoading={true}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    // Check for skeleton loaders instead of text
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays error state', () => {
    const onCancel = vi.fn();
    const error = new Error('Failed to load bookings');
    render(
      <MyBookingsPanel
        bookings={undefined}
        isLoading={false}
        error={error}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    expect(screen.getByText(/error loading bookings/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to load bookings/i)).toBeInTheDocument();
  });

  it('displays empty state when no bookings', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={[]}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    expect(screen.getByText(/you have no bookings/i)).toBeInTheDocument();
    expect(screen.getByText(/search for a room to create your first booking/i)).toBeInTheDocument();
  });

  it('displays booking cards with room name, date, and time', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={mockBookings}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    expect(screen.getByText('Meeting Room B')).toBeInTheDocument();
    
    // Check for dates (format: MMM dd, yyyy)
    expect(screen.getByText(/Jan 25, 2026/i)).toBeInTheDocument();
    expect(screen.getByText(/Jan 26, 2026/i)).toBeInTheDocument();
  });

  it('displays status badges correctly', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={mockBookings}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    const confirmedBadges = screen.getAllByText('Confirmed');
    expect(confirmedBadges.length).toBeGreaterThan(0);
    
    expect(screen.getByText('Cancelled')).toBeInTheDocument();
  });

  it('shows cancel button for confirmed future bookings', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={mockBookings}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    const cancelButtons = screen.getAllByRole('button', { name: /cancel booking/i });
    expect(cancelButtons.length).toBeGreaterThan(0);
  });

  it('disables cancel button for cancelled bookings', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={mockBookings}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    const alreadyCancelledButton = screen.getByRole('button', { name: /already cancelled/i });
    expect(alreadyCancelledButton).toBeDisabled();
  });

  it('calls onCancel when cancel button is clicked', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={mockBookings}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    const cancelButtons = screen.getAllByRole('button', { name: /cancel booking/i });
    await user.click(cancelButtons[0]);

    expect(onCancel).toHaveBeenCalledWith(expect.any(String));
  });

  it('disables cancel buttons when cancelling is in progress', () => {
    const onCancel = vi.fn();
    render(
      <MyBookingsPanel
        bookings={mockBookings}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={true}
      />
    );

    const cancellingButtons = screen.getAllByRole('button', { name: /cancelling/i });
    cancellingButtons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it('sorts bookings by start time (upcoming first)', () => {
    const onCancel = vi.fn();
    const unsortedBookings: Booking[] = [
      {
        id: '1',
        userId: 'user-1',
        roomId: 'room-1',
        roomName: 'Room C',
        startAt: '2026-01-27T09:00:00Z',
        endAt: '2026-01-27T10:00:00Z',
        status: 'confirmed',
        createdAt: '2026-01-19T10:00:00Z',
        updatedAt: '2026-01-19T10:00:00Z',
      },
      {
        id: '2',
        userId: 'user-1',
        roomId: 'room-2',
        roomName: 'Room A',
        startAt: '2026-01-25T09:00:00Z',
        endAt: '2026-01-25T10:00:00Z',
        status: 'confirmed',
        createdAt: '2026-01-19T11:00:00Z',
        updatedAt: '2026-01-19T11:00:00Z',
      },
      {
        id: '3',
        userId: 'user-1',
        roomId: 'room-3',
        roomName: 'Room B',
        startAt: '2026-01-26T09:00:00Z',
        endAt: '2026-01-26T10:00:00Z',
        status: 'confirmed',
        createdAt: '2026-01-19T12:00:00Z',
        updatedAt: '2026-01-19T12:00:00Z',
      },
    ];

    render(
      <MyBookingsPanel
        bookings={unsortedBookings}
        isLoading={false}
        error={null}
        onCancel={onCancel}
        isCancelling={false}
      />
    );

    const roomNames = screen.getAllByRole('heading', { level: 3 });
    expect(roomNames[0]).toHaveTextContent('Room A');
    expect(roomNames[1]).toHaveTextContent('Room B');
    expect(roomNames[2]).toHaveTextContent('Room C');
  });
});
