import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Booking } from '../types';

interface AllBookingsParams {
  userId?: string;
  roomId?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

interface AllBookingsResponse {
  bookings: Booking[];
  total: number;
  page: number;
}

async function fetchAllBookings(params?: AllBookingsParams): Promise<AllBookingsResponse> {
  const response = await api.get<AllBookingsResponse>('/api/bookings/all', { params });
  return response.data;
}

export function useAllBookings(params?: AllBookingsParams) {
  return useQuery({
    queryKey: ['bookings', 'all', params],
    queryFn: () => fetchAllBookings(params),
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
