import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useSearchRooms } from './useSearchRooms';
import { api } from '../services/api';
import type { SearchCriteria, RoomAvailability } from '../types';
import React from 'react';

vi.mock('../services/api', () => ({
  api: {
    get: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client: queryClient }, children);
  };
};

describe('useSearchRooms', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns empty array when criteria is null', async () => {
    const { result } = renderHook(() => useSearchRooms(null), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(false);
    });
  });

  it('fetches rooms with valid criteria', async () => {
    const mockRooms: RoomAvailability[] = [
      {
        id: '1',
        name: 'Room A',
        capacity: 6,
        equipment: ['Projector'],
        status: 'active',
        availabilityStatus: 'available',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ];

    vi.mocked(api.get).mockResolvedValueOnce({ data: mockRooms });

    const testDate = new Date('2026-01-25T12:00:00Z');
    const criteria: SearchCriteria = {
      date: testDate,
      startTime: '09:00',
      endTime: '10:00',
      minCapacity: 4,
      equipmentTags: ['Projector'],
    };

    const { result } = renderHook(() => useSearchRooms(criteria), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockRooms);
    expect(api.get).toHaveBeenCalledWith('/api/rooms/search', {
      params: expect.objectContaining({
        startTime: '09:00',
        endTime: '10:00',
        minCapacity: 4,
        equipment: ['Projector'],
      }),
    });
  });

  it('validates time range before API call', async () => {
    const criteria: SearchCriteria = {
      date: new Date('2026-01-25'),
      startTime: '10:00',
      endTime: '09:00', // Invalid: end before start
    };

    const { result } = renderHook(() => useSearchRooms(criteria), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(new Error('Start time must be before end time'));
    expect(api.get).not.toHaveBeenCalled();
  });

  it('handles API errors', async () => {
    const mockError = new Error('Network error');
    vi.mocked(api.get).mockRejectedValueOnce(mockError);

    const criteria: SearchCriteria = {
      date: new Date('2026-01-25'),
      startTime: '09:00',
      endTime: '10:00',
    };

    const { result } = renderHook(() => useSearchRooms(criteria), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toEqual(mockError);
  });

  it('handles optional parameters correctly', async () => {
    const mockRooms: RoomAvailability[] = [];
    vi.mocked(api.get).mockResolvedValueOnce({ data: mockRooms });

    const testDate = new Date('2026-01-25T12:00:00Z');
    const criteria: SearchCriteria = {
      date: testDate,
      startTime: '09:00',
      endTime: '10:00',
      // No minCapacity or equipmentTags
    };

    const { result } = renderHook(() => useSearchRooms(criteria), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(api.get).toHaveBeenCalledWith('/api/rooms/search', {
      params: expect.objectContaining({
        startTime: '09:00',
        endTime: '10:00',
        minCapacity: undefined,
        equipment: undefined,
      }),
    });
  });
});
