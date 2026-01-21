import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import type { SearchCriteria, RuleConfig } from '../types';

interface SearchPanelProps {
  onSearch: (criteria: SearchCriteria) => void;
  isLoading: boolean;
  rules?: RuleConfig;
}

interface SearchFormData {
  date: string;
  startTime: string;
  endTime: string;
  minCapacity: string;
  equipmentTags: string[];
}

const EQUIPMENT_OPTIONS = [
  'Projector',
  'Whiteboard',
  'TV',
  'Conference Phone',
  'Video Camera',
  'Microphone',
  'HDMI Cable',
];

export function SearchPanel({ onSearch, isLoading, rules }: SearchPanelProps) {
  const [selectedEquipment, setSelectedEquipment] = useState<string[]>([]);
  
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SearchFormData>({
    defaultValues: {
      date: format(new Date(Date.now() + 24 * 60 * 60 * 1000), 'yyyy-MM-dd'), // Tomorrow by default
      startTime: '09:00',
      endTime: '10:00',
      minCapacity: '',
      equipmentTags: [],
    },
  });

  // Generate time options in 15-minute intervals
  const generateTimeOptions = () => {
    const options: string[] = [];
    const openHour = rules?.openHour ?? 8;
    const closeHour = rules?.closeHour ?? 22;
    const interval = rules?.timeSlotIntervalMinutes ?? 15;

    for (let hour = openHour; hour < closeHour; hour++) {
      for (let minute = 0; minute < 60; minute += interval) {
        const timeStr = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        options.push(timeStr);
      }
    }
    // Add the closing hour
    options.push(`${closeHour.toString().padStart(2, '0')}:00`);
    return options;
  };

  const timeOptions = generateTimeOptions();

  const handleEquipmentToggle = (equipment: string) => {
    setSelectedEquipment((prev) => {
      if (prev.includes(equipment)) {
        return prev.filter((e) => e !== equipment);
      }
      return [...prev, equipment];
    });
  };

  const onSubmit = (data: SearchFormData) => {
    const criteria: SearchCriteria = {
      date: new Date(data.date),
      startTime: data.startTime,
      endTime: data.endTime,
      minCapacity: data.minCapacity ? parseInt(data.minCapacity, 10) : undefined,
      equipmentTags: selectedEquipment.length > 0 ? selectedEquipment : undefined,
    };
    onSearch(criteria);
  };

  // Validate time range
  const startTime = watch('startTime');
  const endTime = watch('endTime');

  useEffect(() => {
    if (startTime && endTime && startTime >= endTime) {
      setValue('endTime', '');
    }
  }, [startTime, endTime, setValue]);

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-3 sm:mb-4">Search Rooms</h2>
      
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4">
        {/* Date Picker */}
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-gray-700 mb-1">
            Date
          </label>
          <input
            type="date"
            id="date"
            {...register('date', { required: 'Date is required' })}
            min={format(new Date(), 'yyyy-MM-dd')}
            className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          />
          {errors.date && (
            <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
          )}
        </div>

        {/* Start Time Picker */}
        <div>
          <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
            Start Time
          </label>
          <select
            id="startTime"
            {...register('startTime', { required: 'Start time is required' })}
            className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          >
            {timeOptions.map((time) => (
              <option key={time} value={time}>
                {time}
              </option>
            ))}
          </select>
          {errors.startTime && (
            <p className="mt-1 text-sm text-red-600">{errors.startTime.message}</p>
          )}
        </div>

        {/* End Time Picker */}
        <div>
          <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
            End Time
          </label>
          <select
            id="endTime"
            {...register('endTime', { 
              required: 'End time is required',
              validate: (value) => value > startTime || 'End time must be after start time'
            })}
            className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          >
            <option value="">Select end time</option>
            {timeOptions
              .filter((time) => time > startTime)
              .map((time) => (
                <option key={time} value={time}>
                  {time}
                </option>
              ))}
          </select>
          {errors.endTime && (
            <p className="mt-1 text-sm text-red-600">{errors.endTime.message}</p>
          )}
        </div>

        {/* Capacity Input */}
        <div>
          <label htmlFor="minCapacity" className="block text-sm font-medium text-gray-700 mb-1">
            Minimum Capacity (optional)
          </label>
          <input
            type="number"
            id="minCapacity"
            {...register('minCapacity', {
              min: { value: 1, message: 'Capacity must be at least 1' },
            })}
            min="1"
            placeholder="e.g., 4"
            className="w-full px-3 py-2 sm:py-2.5 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 text-base"
          />
          {errors.minCapacity && (
            <p className="mt-1 text-sm text-red-600">{errors.minCapacity.message}</p>
          )}
        </div>

        {/* Equipment Tags Multi-Select */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Equipment (optional)
          </label>
          <div className="space-y-2 max-h-40 sm:max-h-48 overflow-y-auto border border-gray-300 rounded-md p-2 sm:p-3">
            {EQUIPMENT_OPTIONS.map((equipment) => (
              <label
                key={equipment}
                className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-1.5 sm:p-1 rounded touch-manipulation"
              >
                <input
                  type="checkbox"
                  checked={selectedEquipment.includes(equipment)}
                  onChange={() => handleEquipmentToggle(equipment)}
                  className="h-5 w-5 sm:h-4 sm:w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">{equipment}</span>
              </label>
            ))}
          </div>
          {selectedEquipment.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {selectedEquipment.map((equipment) => (
                <span
                  key={equipment}
                  className="inline-flex items-center px-2.5 py-1.5 sm:px-2 sm:py-1 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
                >
                  {equipment}
                  <button
                    type="button"
                    onClick={() => handleEquipmentToggle(equipment)}
                    className="ml-1.5 inline-flex items-center justify-center w-5 h-5 sm:w-4 sm:h-4 rounded-full hover:bg-indigo-200 touch-manipulation"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Booking Rules Reference */}
        {rules && (
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <h3 className="text-sm font-medium text-blue-900 mb-2">Booking Rules</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Operating hours: {rules.openHour}:00 - {rules.closeHour}:00</li>
              <li>• Duration: {rules.minDurationMinutes}-{rules.maxDurationMinutes} minutes</li>
              <li>• Time slots: {rules.timeSlotIntervalMinutes}-minute intervals</li>
              <li>• Max active bookings: {rules.maxActiveBookings}</li>
              <li>• Book up to {rules.maxDaysAhead} days ahead</li>
              <li>• Minimum notice: {rules.minNoticeMinutes} minutes</li>
            </ul>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full px-4 py-3 sm:py-2 text-sm sm:text-base font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation"
        >
          {isLoading ? 'Searching...' : 'Search Rooms'}
        </button>
      </form>
    </div>
  );
}
