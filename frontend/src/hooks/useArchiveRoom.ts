import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { toast } from '../utils/toast';

async function archiveRoom(roomId: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/api/rooms/${roomId}`);
  return response.data;
}

export function useArchiveRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveRoom,
    onError: (error) => {
      const errorMessage =
        (error as any)?.response?.data?.error?.message ||
        (error as Error)?.message ||
        'Failed to archive room';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room archived successfully!');
    },
  });
}
