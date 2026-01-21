import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Booking, CreateBookingRequest } from '../types';
import { toast } from '../utils/toast';

async function createBooking(request: CreateBookingRequest): Promise<Booking> {
  const response = await api.post<Booking>('/api/bookings', request);
  return response.data;
}

export function useCreateBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createBooking,
    onMutate: async (newBooking) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['bookings', 'my'] });
      await queryClient.cancelQueries({ queryKey: ['rooms', 'search'] });

      // Snapshot the previous values
      const previousBookings = queryClient.getQueryData(['bookings', 'my']);
      const previousRooms = queryClient.getQueryData(['rooms', 'search']);

      // Optimistically update bookings list
      queryClient.setQueryData(['bookings', 'my'], (old: Booking[] | undefined) => {
        if (!old) return old;
        
        const optimisticBooking: Booking = {
          id: 'temp-' + Date.now(),
          userId: 'current-user',
          roomId: newBooking.roomId,
          startAt: newBooking.startAt,
          endAt: newBooking.endAt,
          status: 'confirmed',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          canCancel: true,
        };
        
        return [...old, optimisticBooking];
      });

      return { previousBookings, previousRooms };
    },
    onError: (error, _newBooking, context) => {
      // Rollback to previous state on error
      if (context?.previousBookings) {
        queryClient.setQueryData(['bookings', 'my'], context.previousBookings);
      }
      if (context?.previousRooms) {
        queryClient.setQueryData(['rooms', 'search'], context.previousRooms);
      }

      // Extract error message
      const errorMessage =
        (error as any)?.response?.data?.error?.message ||
        (error as Error)?.message ||
        'Failed to create booking';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', 'search'] });
      
      toast.success('Booking created successfully!');
    },
  });
}
