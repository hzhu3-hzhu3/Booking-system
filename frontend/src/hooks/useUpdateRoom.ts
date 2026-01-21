import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Room, UpdateRoomRequest } from '../types';
import { toast } from '../utils/toast';

interface UpdateRoomParams {
  id: string;
  data: UpdateRoomRequest;
}

async function updateRoom({ id, data }: UpdateRoomParams): Promise<Room> {
  const response = await api.put<Room>(`/api/rooms/${id}`, data);
  return response.data;
}

export function useUpdateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateRoom,
    onError: (error) => {
      const errorMessage =
        (error as any)?.response?.data?.error?.message ||
        (error as Error)?.message ||
        'Failed to update room';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room updated successfully!');
    },
  });
}
