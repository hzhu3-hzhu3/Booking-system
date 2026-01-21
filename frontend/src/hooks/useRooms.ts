import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Room } from '../types';

async function fetchAllRooms(): Promise<Room[]> {
  const response = await api.get<Room[]>('/api/rooms');
  return response.data;
}

export function useRooms() {
  return useQuery({
    queryKey: ['rooms', 'all'],
    queryFn: fetchAllRooms,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
