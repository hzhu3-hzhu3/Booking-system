import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Booking } from '../types';

async function fetchMyBookings(): Promise<Booking[]> {
  const response = await api.get<Booking[]>('/api/bookings/my');
  return response.data;
}

export function useMyBookings() {
  return useQuery({
    queryKey: ['bookings', 'my'],
    queryFn: fetchMyBookings,
    staleTime: 1 * 60 * 1000, // 1 minute
  });
}
