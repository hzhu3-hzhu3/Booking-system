import { format, parseISO, isPast } from 'date-fns';
import type { Booking } from '../types';
import { BookingCardSkeleton } from './SkeletonLoader';

interface MyBookingsPanelProps {
  bookings: Booking[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onCancel: (bookingId: string) => void;
  isCancelling: boolean;
}

export function MyBookingsPanel({
  bookings,
  isLoading,
  error,
  onCancel,
  isCancelling,
}: MyBookingsPanelProps) {
  const getStatusBadgeStyles = (status: Booking['status']) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      case 'expired':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusLabel = (status: Booking['status']) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const canCancelBooking = (booking: Booking): boolean => {
    // Can cancel if status is confirmed and end time is in the future
    if (booking.status !== 'confirmed') {
      return false;
    }
    
    const endTime = parseISO(booking.endAt);
    return !isPast(endTime);
  };

  const formatDate = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'MMM dd, yyyy');
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string): string => {
    try {
      return format(parseISO(dateString), 'HH:mm');
    } catch {
      return dateString;
    }
  };

  // Sort bookings by start time (upcoming first)
  const sortedBookings = bookings
    ? [...bookings].sort((a, b) => {
        const dateA = parseISO(a.startAt);
        const dateB = parseISO(b.startAt);
        return dateA.getTime() - dateB.getTime();
      })
    : [];

  // Filter to show only upcoming and recent bookings
  const displayBookings = sortedBookings.filter((booking) => {
    // Show confirmed bookings, or cancelled/expired from the last 7 days
    if (booking.status === 'confirmed') {
      return true;
    }
    const bookingDate = parseISO(booking.startAt);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return bookingDate >= sevenDaysAgo;
  });

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">My Bookings</h2>

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 mb-3 sm:mb-4">
          <p className="text-sm text-red-800">
            Error loading bookings: {error.message}
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3 sm:space-y-4">
          <BookingCardSkeleton />
          <BookingCardSkeleton />
          <BookingCardSkeleton />
        </div>
      )}

      {/* No Bookings */}
      {!isLoading && !error && displayBookings.length === 0 && (
        <div className="text-center py-8 sm:py-12">
          <svg
            className="mx-auto h-10 w-10 sm:h-12 sm:w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <p className="mt-3 text-sm sm:text-base text-gray-600">You have no bookings.</p>
          <p className="mt-1 text-xs sm:text-sm text-gray-500">
            Search for a room to create your first booking.
          </p>
        </div>
      )}

      {/* Booking Cards */}
      {!isLoading && !error && displayBookings.length > 0 && (
        <div className="space-y-3 sm:space-y-4">
          {displayBookings.map((booking) => {
            const isCancellable = canCancelBooking(booking);
            
            return (
              <div
                key={booking.id}
                className="border border-gray-200 rounded-lg p-3 sm:p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                      {booking.roomName || `Room ${booking.roomId}`}
                    </h3>
                    <div className="mt-1 space-y-1">
                      <div className="flex items-center text-sm text-gray-600">
                        <svg
                          className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>{formatDate(booking.startAt)}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <svg
                          className="h-4 w-4 mr-2 text-gray-500 flex-shrink-0"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        <span>
                          {formatTime(booking.startAt)} - {formatTime(booking.endAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center px-3 py-1.5 sm:py-1 rounded-full text-xs font-medium border whitespace-nowrap ${getStatusBadgeStyles(
                      booking.status
                    )}`}
                  >
                    {getStatusLabel(booking.status)}
                  </span>
                </div>

                {/* Cancel Button */}
                <div className="mt-4">
                  {isCancellable ? (
                    <button
                      onClick={() => onCancel(booking.id)}
                      disabled={isCancelling}
                      className="w-full px-4 py-3 sm:py-2 text-sm sm:text-base font-medium text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors touch-manipulation"
                    >
                      {isCancelling ? 'Cancelling...' : 'Cancel Booking'}
                    </button>
                  ) : (
                    <button
                      disabled
                      className="w-full px-4 py-3 sm:py-2 text-sm sm:text-base font-medium text-gray-400 bg-gray-100 rounded-md cursor-not-allowed"
                    >
                      {booking.status === 'cancelled'
                        ? 'Already Cancelled'
                        : booking.status === 'expired'
                        ? 'Booking Expired'
                        : 'Cannot Cancel'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
