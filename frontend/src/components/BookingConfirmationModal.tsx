import { useState } from 'react';
import { format, parse } from 'date-fns';
import type { RoomAvailability, SearchCriteria } from '../types';
import { useCreateBooking } from '../hooks/useCreateBooking';
import { useRules } from '../hooks/useRules';

interface BookingConfirmationModalProps {
  room: RoomAvailability;
  searchCriteria: SearchCriteria;
  onClose: () => void;
  onSuccess: () => void;
}

export function BookingConfirmationModal({
  room,
  searchCriteria,
  onClose,
  onSuccess,
}: BookingConfirmationModalProps) {
  const [bookingError, setBookingError] = useState<string | null>(null);
  const { data: rules } = useRules();
  const createBookingMutation = useCreateBooking();

  const handleConfirmBooking = async () => {
    setBookingError(null);

    try {
      // Parse time components
      const [startHour, startMin] = searchCriteria.startTime.split(':').map(Number);
      const [endHour, endMin] = searchCriteria.endTime.split(':').map(Number);
      
      // Create Date objects using UTC methods to match backend validation
      const startDate = new Date(searchCriteria.date);
      startDate.setUTCHours(startHour, startMin, 0, 0);
      
      const endDate = new Date(searchCriteria.date);
      endDate.setUTCHours(endHour, endMin, 0, 0);
      
      // Convert to ISO string (already in UTC)
      const startAt = startDate.toISOString();
      const endAt = endDate.toISOString();

      await createBookingMutation.mutateAsync({
        roomId: room.id,
        startAt,
        endAt,
      });

      onSuccess();
    } catch (error: any) {
      // Extract error message from API response
      const errorMessage =
        error?.response?.data?.error?.message ||
        error?.message ||
        'Failed to create booking. Please try again.';
      setBookingError(errorMessage);
    }
  };

  const formatTime = (time: string) => {
    try {
      const parsed = parse(time, 'HH:mm', new Date());
      return format(parsed, 'h:mm a');
    } catch {
      return time;
    }
  };

  const calculateDuration = () => {
    const [startHour, startMin] = searchCriteria.startTime.split(':').map(Number);
    const [endHour, endMin] = searchCriteria.endTime.split(':').map(Number);
    const durationMinutes = (endHour * 60 + endMin) - (startHour * 60 + startMin);
    
    if (durationMinutes >= 60) {
      const hours = Math.floor(durationMinutes / 60);
      const minutes = durationMinutes % 60;
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${durationMinutes}m`;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        ></div>

        {/* Modal panel */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full mx-4 sm:mx-0">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900">
                Confirm Booking
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500 focus:outline-none touch-manipulation p-1"
              >
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Booking Details */}
            <div className="space-y-3 sm:space-y-4">
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3 sm:p-4">
                <h4 className="font-medium text-indigo-900 mb-2 sm:mb-3 text-sm sm:text-base">Booking Details</h4>
                <dl className="space-y-1.5 sm:space-y-2">
                  <div className="flex justify-between text-xs sm:text-sm">
                    <dt className="text-indigo-700">Room:</dt>
                    <dd className="font-medium text-indigo-900">{room.name}</dd>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <dt className="text-indigo-700">Date:</dt>
                    <dd className="font-medium text-indigo-900">
                      {format(searchCriteria.date, 'EEEE, MMMM d, yyyy')}
                    </dd>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <dt className="text-indigo-700">Time:</dt>
                    <dd className="font-medium text-indigo-900">
                      {formatTime(searchCriteria.startTime)} - {formatTime(searchCriteria.endTime)}
                    </dd>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <dt className="text-indigo-700">Duration:</dt>
                    <dd className="font-medium text-indigo-900">{calculateDuration()}</dd>
                  </div>
                  <div className="flex justify-between text-xs sm:text-sm">
                    <dt className="text-indigo-700">Capacity:</dt>
                    <dd className="font-medium text-indigo-900">{room.capacity} people</dd>
                  </div>
                </dl>
              </div>

              {/* Equipment */}
              {room.equipment && room.equipment.length > 0 && (
                <div>
                  <h4 className="text-xs sm:text-sm font-medium text-gray-700 mb-2">Available Equipment:</h4>
                  <div className="flex flex-wrap gap-1.5 sm:gap-2">
                    {room.equipment.map((item) => (
                      <span
                        key={item}
                        className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 text-gray-700"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Booking Rules Summary */}
              {rules && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                  <h4 className="text-xs sm:text-sm font-medium text-blue-900 mb-2">Booking Rules</h4>
                  <ul className="text-xs text-blue-800 space-y-1">
                    <li>• You can have up to {rules.maxActiveBookings} active bookings</li>
                    <li>• Bookings must be {rules.minDurationMinutes}-{rules.maxDurationMinutes} minutes</li>
                    <li>• Book at least {rules.minNoticeMinutes} minutes in advance</li>
                    <li>• Book up to {rules.maxDaysAhead} days ahead</li>
                    {rules.cooldownMinutes && (
                      <li>• Wait {rules.cooldownMinutes} minutes between bookings</li>
                    )}
                    {rules.maxConsecutive && (
                      <li>• Maximum {rules.maxConsecutive} consecutive bookings per room</li>
                    )}
                  </ul>
                </div>
              )}

              {/* Error Message */}
              {bookingError && (
                <div className="bg-red-50 border border-red-200 rounded-md p-3">
                  <div className="flex">
                    <svg
                      className="h-5 w-5 text-red-400 mr-2 flex-shrink-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <p className="text-xs sm:text-sm text-red-800">{bookingError}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3">
            <button
              onClick={onClose}
              disabled={createBookingMutation.isPending}
              className="w-full sm:w-auto inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-3 sm:py-2 bg-white text-sm sm:text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirmBooking}
              disabled={createBookingMutation.isPending}
              className="w-full sm:w-auto inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-3 sm:py-2 bg-indigo-600 text-sm sm:text-base font-medium text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
            >
              {createBookingMutation.isPending ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Booking...
                </>
              ) : (
                'Confirm Booking'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
