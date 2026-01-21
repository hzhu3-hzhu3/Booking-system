import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MaintenanceBlock } from '../types';

interface MaintenanceBlocksParams {
  roomId?: string;
  startDate?: string;
  endDate?: string;
}

async function fetchMaintenanceBlocks(params?: MaintenanceBlocksParams): Promise<MaintenanceBlock[]> {
  const response = await api.get<MaintenanceBlock[]>('/api/maintenance-blocks', { params });
  return response.data;
}

export function useMaintenanceBlocks(params?: MaintenanceBlocksParams) {
  return useQuery({
    queryKey: ['maintenance-blocks', params],
    queryFn: () => fetchMaintenanceBlocks(params),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });
}
