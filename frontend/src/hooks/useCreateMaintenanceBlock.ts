import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { MaintenanceBlock, CreateMaintenanceBlockRequest } from '../types';
import { toast } from '../utils/toast';

async function createMaintenanceBlock(data: CreateMaintenanceBlockRequest): Promise<MaintenanceBlock> {
  const response = await api.post<MaintenanceBlock>('/api/maintenance-blocks', data);
  return response.data;
}

export function useCreateMaintenanceBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createMaintenanceBlock,
    onError: (error) => {
      const errorMessage =
        (error as any)?.response?.data?.error?.message ||
        (error as Error)?.message ||
        'Failed to create maintenance block';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', 'search'] });
      toast.success('Maintenance block created successfully!');
    },
  });
}
