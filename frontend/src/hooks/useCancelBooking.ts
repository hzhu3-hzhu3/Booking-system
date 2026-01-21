import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import type { Booking } from '../types';
import { toast } from '../utils/toast';

async function cancelBooking(bookingId: string): Promise<{ success: boolean }> {
  const response = await api.delete<{ success: boolean }>(`/api/bookings/${bookingId}`);
  return response.data;
}

export function useCancelBooking() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: cancelBooking,
    onMutate: async (bookingId) => {
      // Cancel any outgoing refetches to avoid overwriting optimistic update
      await queryClient.cancelQueries({ queryKey: ['bookings', 'my'] });
      await queryClient.cancelQueries({ queryKey: ['rooms', 'search'] });

      // Snapshot the previous values
      const previousBookings = queryClient.getQueryData(['bookings', 'my']);
      const previousRooms = queryClient.getQueryData(['rooms', 'search']);

      // Optimistically update bookings list
      queryClient.setQueryData(['bookings', 'my'], (old: Booking[] | undefined) => {
        if (!old) return old;
        
        return old.map((booking) =>
          booking.id === bookingId
            ? {
                ...booking,
                status: 'cancelled' as const,
                cancelledAt: new Date().toISOString(),
              }
            : booking
        );
      });

      return { previousBookings, previousRooms };
    },
    onError: (error, _bookingId, context) => {
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
        'Failed to cancel booking';
      
      toast.error(errorMessage);
    },
    onSuccess: () => {
      // Invalidate and refetch relevant queries
      queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', 'search'] });
      
      toast.success('Booking cancelled successfully!');
    },
  });
}
