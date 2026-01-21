import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Room, CreateRoomRequest } from '../types';
import { toast } from '../utils/toast';

async function createRoom(data: CreateRoomRequest): Promise<Room> {
  const response = await api.post<Room>('/api/rooms', data);
  return response.data;
}

export function useCreateRoom() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createRoom,
    onError: (error) => {
      const errorMessage =
        (error as any)?.response?.data?.error?.message ||
        (error as Error)?.message ||
        'Failed to create room';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      toast.success('Room created successfully!');
    },
  });
}
