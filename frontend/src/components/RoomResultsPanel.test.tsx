import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RoomResultsPanel } from './RoomResultsPanel';
import type { RoomAvailability, SearchCriteria } from '../types';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
    mutations: { retry: false },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

describe('RoomResultsPanel', () => {
  const mockSearchCriteria: SearchCriteria = {
    date: new Date('2026-01-20'),
    startTime: '09:00',
    endTime: '10:00',
    minCapacity: 4,
  };

  const mockRooms: RoomAvailability[] = [
    {
      id: '1',
      name: 'Conference Room A',
      capacity: 8,
      equipment: ['Projector', 'Whiteboard'],
      status: 'active',
      availabilityStatus: 'available',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: '2',
      name: 'Meeting Room B',
      capacity: 4,
      equipment: ['TV'],
      status: 'active',
      availabilityStatus: 'unavailable',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
    {
      id: '3',
      name: 'Workshop Room C',
      capacity: 12,
      equipment: [],
      status: 'maintenance',
      availabilityStatus: 'maintenance',
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    },
  ];

  it('displays loading state when isLoading is true', () => {
    render(
      <RoomResultsPanel
        rooms={undefined}
        searchCriteria={mockSearchCriteria}
        isLoading={true}
        error={null}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    // Check for skeleton loaders instead of text
    const skeletonElements = document.querySelectorAll('.animate-pulse');
    expect(skeletonElements.length).toBeGreaterThan(0);
  });

  it('displays error message when error is present', () => {
    const error = new Error('Failed to fetch rooms');
    render(
      <RoomResultsPanel
        rooms={undefined}
        searchCriteria={mockSearchCriteria}
        isLoading={false}
        error={error}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText(/error loading rooms/i)).toBeInTheDocument();
    expect(screen.getByText(/failed to fetch rooms/i)).toBeInTheDocument();
  });

  it('displays prompt when no search criteria is provided', () => {
    render(
      <RoomResultsPanel
        rooms={undefined}
        searchCriteria={null}
        isLoading={false}
        error={null}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText(/use the search panel to find available rooms/i)).toBeInTheDocument();
  });

  it('displays no results message when rooms array is empty', () => {
    render(
      <RoomResultsPanel
        rooms={[]}
        searchCriteria={mockSearchCriteria}
        isLoading={false}
        error={null}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText(/no rooms found matching your criteria/i)).toBeInTheDocument();
  });

  it('displays room cards with correct information', () => {
    render(
      <RoomResultsPanel
        rooms={mockRooms}
        searchCriteria={mockSearchCriteria}
        isLoading={false}
        error={null}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    // Check room names
    expect(screen.getByText('Conference Room A')).toBeInTheDocument();
    expect(screen.getByText('Meeting Room B')).toBeInTheDocument();
    expect(screen.getByText('Workshop Room C')).toBeInTheDocument();

    // Check capacities
    expect(screen.getByText(/capacity: 8/i)).toBeInTheDocument();
    expect(screen.getByText(/capacity: 4/i)).toBeInTheDocument();
    expect(screen.getByText(/capacity: 12/i)).toBeInTheDocument();

    // Check equipment
    expect(screen.getByText('Projector')).toBeInTheDocument();
    expect(screen.getByText('Whiteboard')).toBeInTheDocument();
    expect(screen.getByText('TV')).toBeInTheDocument();
  });

  it('displays correct availability badges', () => {
    render(
      <RoomResultsPanel
        rooms={mockRooms}
        searchCriteria={mockSearchCriteria}
        isLoading={false}
        error={null}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    expect(screen.getByText('Available')).toBeInTheDocument();
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
    expect(screen.getByText('Maintenance')).toBeInTheDocument();
  });

  it('shows Book button only for available rooms', () => {
    render(
      <RoomResultsPanel
        rooms={mockRooms}
        searchCriteria={mockSearchCriteria}
        isLoading={false}
        error={null}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    const bookButtons = screen.getAllByRole('button', { name: /book this room/i });
    expect(bookButtons).toHaveLength(1);

    const notAvailableButtons = screen.getAllByRole('button', { name: /not available/i });
    expect(notAvailableButtons).toHaveLength(1);

    const maintenanceButtons = screen.getAllByRole('button', { name: /under maintenance/i });
    expect(maintenanceButtons).toHaveLength(1);
  });

  it('opens booking modal when Book button is clicked', async () => {
    const user = userEvent.setup();
    
    render(
      <RoomResultsPanel
        rooms={mockRooms}
        searchCriteria={mockSearchCriteria}
        isLoading={false}
        error={null}
        onBookingSuccess={vi.fn()}
      />,
      { wrapper: Wrapper }
    );

    const bookButton = screen.getByRole('button', { name: /book this room/i });
    await user.click(bookButton);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /confirm booking/i })).toBeInTheDocument();
    });
  });
});
