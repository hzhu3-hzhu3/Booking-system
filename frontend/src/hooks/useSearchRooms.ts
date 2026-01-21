import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { api } from '../services/api';
import type { SearchCriteria, RoomAvailability } from '../types';

interface SearchRoomsParams {
  date: string;
  startTime: string;
  endTime: string;
  minCapacity?: number;
  equipment?: string[];
}

async function searchRooms(params: SearchRoomsParams): Promise<RoomAvailability[]> {
  const response = await api.get<RoomAvailability[]>('/api/rooms/search', {
    params: {
      date: params.date,
      startTime: params.startTime,
      endTime: params.endTime,
      minCapacity: params.minCapacity,
      equipment: params.equipment,
    },
  });
  return response.data;
}

export function useSearchRooms(criteria: SearchCriteria | null) {
  return useQuery({
    queryKey: ['rooms', 'search', criteria],
    queryFn: () => {
      if (!criteria) {
        return Promise.resolve([]);
      }

      // Validate time range before making API call
      if (criteria.startTime >= criteria.endTime) {
        throw new Error('Start time must be before end time');
      }

      const params: SearchRoomsParams = {
        date: format(criteria.date, 'yyyy-MM-dd'),
        startTime: criteria.startTime,
        endTime: criteria.endTime,
        minCapacity: criteria.minCapacity,
        equipment: criteria.equipmentTags,
      };

      return searchRooms(params);
    },
    enabled: criteria !== null,
    staleTime: 1 * 60 * 1000, // 1 minute - data is considered fresh
    gcTime: 5 * 60 * 1000, // 5 minutes - keep in cache for 5 minutes
    refetchOnMount: false, // Don't refetch on component mount if data is fresh
    refetchOnWindowFocus: false, // Don't refetch when window regains focus
  });
}
