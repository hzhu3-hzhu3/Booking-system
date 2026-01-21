import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from '../utils/toast';

async function deleteMaintenanceBlock(blockId: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/api/maintenance-blocks/${blockId}`);
  return response.data;
}

export function useDeleteMaintenanceBlock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteMaintenanceBlock,
    onError: (error) => {
      const errorMessage =
        (error as any)?.response?.data?.error?.message ||
        (error as Error)?.message ||
        'Failed to delete maintenance block';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maintenance-blocks'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', 'search'] });
      toast.success('Maintenance block deleted successfully!');
    },
  });
}
