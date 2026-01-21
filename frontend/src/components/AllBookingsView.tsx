import { useState } from 'react';
import { format } from 'date-fns';
import { useAllBookings, useRooms, useCancelBooking } from '../hooks';
import type { BookingStatus } from '../types';
import { SkeletonLoader } from './SkeletonLoader';

interface AllBookingsViewProps {
  onClose: () => void;
}

export function AllBookingsView({ onClose }: AllBookingsViewProps) {
  const [filters, setFilters] = useState({
    roomId: '',
    startDate: '',
    endDate: '',
    page: 1,
    limit: 20,
  });

  const { data: bookingsData, isLoading } = useAllBookings(filters);
  const { data: rooms } = useRooms();
  const cancelBookingMutation = useCancelBooking();

  const handleFilterChange = (key: string, value: string | number) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    setFilters((prev) => ({ ...prev, page: newPage }));
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (confirm('Are you sure you want to cancel this booking as an admin?')) {
      await cancelBookingMutation.mutateAsync(bookingId);
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  const getStatusBadgeClass = (status: BookingStatus) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const totalPages = bookingsData ? Math.ceil(bookingsData.total / filters.limit) : 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">All Bookings</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
              <select
                value={filters.roomId}
                onChange={(e) => handleFilterChange('roomId', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                <option value="">All Rooms</option>
                {rooms?.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => handleFilterChange('startDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => handleFilterChange('endDate', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              />
            </div>
          </div>

          {/* Results */}
          {isLoading ? (
            <div className="space-y-3">
              <SkeletonLoader variant="card" count={5} />
            </div>
          ) : bookingsData && bookingsData.bookings.length > 0 ? (
            <>
              <div className="mb-4 text-sm text-gray-600">
                Showing {(filters.page - 1) * filters.limit + 1} -{' '}
                {Math.min(filters.page * filters.limit, bookingsData.total)} of{' '}
                {bookingsData.total} bookings
              </div>

              <div className="space-y-3">
                {bookingsData.bookings.map((booking) => {
                  const room = rooms?.find((r) => r.id === booking.roomId);
                  const isCancellable =
                    booking.status === 'confirmed' && new Date(booking.endAt) > new Date();

                  return (
                    <div
                      key={booking.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-gray-900">
                              {room?.name || 'Unknown Room'}
                            </h3>
                            <span
                              className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadgeClass(
                                booking.status
                              )}`}
                            >
                              {booking.status}
                            </span>
                          </div>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>
                              <strong>Time:</strong> {formatDateTime(booking.startAt)} -{' '}
                              {formatDateTime(booking.endAt)}
                            </p>
                            <p>
                              <strong>User ID:</strong> {booking.userId}
                            </p>
                            <p>
                              <strong>Booking ID:</strong> {booking.id}
                            </p>
                            {booking.cancelledAt && (
                              <p className="text-red-600">
                                <strong>Cancelled:</strong> {formatDateTime(booking.cancelledAt)}
                              </p>
                            )}
                          </div>
                        </div>
                        {isCancellable && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            disabled={cancelBookingMutation.isPending}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 ml-4 disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="mt-6 flex justify-center items-center gap-2">
                  <button
                    onClick={() => handlePageChange(filters.page - 1)}
                    disabled={filters.page === 1}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600">
                    Page {filters.page} of {totalPages}
                  </span>
                  <button
                    onClick={() => handlePageChange(filters.page + 1)}
                    disabled={filters.page === totalPages}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8 text-gray-600">
              No bookings found
              {(filters.roomId || filters.startDate || filters.endDate) && ' with current filters'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
