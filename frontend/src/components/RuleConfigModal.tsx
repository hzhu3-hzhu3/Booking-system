import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRules, useUpdateRules } from '../hooks';
import type { UpdateRuleConfigRequest } from '../types';

interface RuleConfigModalProps {
  onClose: () => void;
}

export function RuleConfigModal({ onClose }: RuleConfigModalProps) {
  const { data: currentRules, isLoading } = useRules();
  const updateRulesMutation = useUpdateRules();
  const [showWarning, setShowWarning] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<UpdateRuleConfigRequest>();

  useEffect(() => {
    if (currentRules) {
      reset({
        openHour: currentRules.openHour,
        closeHour: currentRules.closeHour,
        timeSlotIntervalMinutes: currentRules.timeSlotIntervalMinutes,
        minDurationMinutes: currentRules.minDurationMinutes,
        maxDurationMinutes: currentRules.maxDurationMinutes,
        maxActiveBookings: currentRules.maxActiveBookings,
        maxConsecutive: currentRules.maxConsecutive || undefined,
        cooldownMinutes: currentRules.cooldownMinutes || undefined,
        minNoticeMinutes: currentRules.minNoticeMinutes,
        maxDaysAhead: currentRules.maxDaysAhead,
      });
    }
  }, [currentRules, reset]);

  const watchedValues = watch();

  useEffect(() => {
    // Check if any values have changed
    if (currentRules && watchedValues) {
      const hasChanges = Object.keys(watchedValues).some((key) => {
        const currentValue = currentRules[key as keyof typeof currentRules];
        const newValue = watchedValues[key as keyof typeof watchedValues];
        return currentValue !== newValue && newValue !== undefined;
      });
      setShowWarning(hasChanges);
    }
  }, [watchedValues, currentRules]);

  const handleUpdateRules = async (data: UpdateRuleConfigRequest) => {
    // Filter out undefined values
    const payload = Object.fromEntries(
      Object.entries(data).filter(([_, value]) => value !== undefined && value !== '')
    ) as UpdateRuleConfigRequest;

    await updateRulesMutation.mutateAsync(payload);
    onClose();
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl p-6">
          <div className="text-center text-gray-600">Loading rules...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Configure Booking Rules</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit(handleUpdateRules)} className="p-6">
          <div className="space-y-6">
            {/* Operating Hours */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Operating Hours</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Open Hour (0-23)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="23"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.openHour ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('openHour', {
                      min: { value: 0, message: 'Must be between 0 and 23' },
                      max: { value: 23, message: 'Must be between 0 and 23' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.openHour && (
                    <p className="mt-1 text-sm text-red-600">{errors.openHour.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Close Hour (0-24)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.closeHour ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('closeHour', {
                      min: { value: 0, message: 'Must be between 0 and 24' },
                      max: { value: 24, message: 'Must be between 0 and 24' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.closeHour && (
                    <p className="mt-1 text-sm text-red-600">{errors.closeHour.message}</p>
                  )}
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Time Slot Interval (minutes)
                </label>
                <input
                  type="number"
                  min="1"
                  className={`w-full px-3 py-2 border rounded-md ${
                    errors.timeSlotIntervalMinutes ? 'border-red-300' : 'border-gray-300'
                  }`}
                  {...register('timeSlotIntervalMinutes', {
                    min: { value: 1, message: 'Must be at least 1' },
                    valueAsNumber: true,
                  })}
                />
                {errors.timeSlotIntervalMinutes && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.timeSlotIntervalMinutes.message}
                  </p>
                )}
                <p className="mt-1 text-xs text-gray-500">
                  Booking start times must align to this interval (e.g., 15 = :00, :15, :30, :45)
                </p>
              </div>
            </div>

            {/* Duration Rules */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Duration Limits</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.minDurationMinutes ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('minDurationMinutes', {
                      min: { value: 1, message: 'Must be at least 1' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.minDurationMinutes && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.minDurationMinutes.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Maximum Duration (minutes)
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.maxDurationMinutes ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('maxDurationMinutes', {
                      min: { value: 1, message: 'Must be at least 1' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.maxDurationMinutes && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.maxDurationMinutes.message}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Fair Usage Rules */}
            <div className="border-b border-gray-200 pb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Fair Usage Rules</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Active Bookings per User
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.maxActiveBookings ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('maxActiveBookings', {
                      min: { value: 1, message: 'Must be at least 1' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.maxActiveBookings && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.maxActiveBookings.message}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Consecutive Bookings (optional)
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Leave empty for no limit"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    {...register('maxConsecutive', {
                      min: { value: 1, message: 'Must be at least 1' },
                      valueAsNumber: true,
                    })}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Limit back-to-back bookings of the same room
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Cooldown Period (minutes, optional)
                  </label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Leave empty for no cooldown"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    {...register('cooldownMinutes', {
                      min: { value: 0, message: 'Must be at least 0' },
                      valueAsNumber: true,
                    })}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Minimum time between creating new bookings
                  </p>
                </div>
              </div>
            </div>

            {/* Booking Horizon Rules */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Booking Horizon</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Notice (minutes)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.minNoticeMinutes ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('minNoticeMinutes', {
                      min: { value: 0, message: 'Must be at least 0' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.minNoticeMinutes && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.minNoticeMinutes.message}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    How far in advance bookings must be made
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Days Ahead
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.maxDaysAhead ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('maxDaysAhead', {
                      min: { value: 1, message: 'Must be at least 1' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.maxDaysAhead && (
                    <p className="mt-1 text-sm text-red-600">{errors.maxDaysAhead.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Maximum days in advance bookings can be made
                  </p>
                </div>
              </div>
            </div>

            {/* Warning */}
            {showWarning && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Warning:</strong> Changing these rules will affect all future bookings.
                  Existing confirmed bookings will not be affected, but new bookings will be
                  validated against the updated rules.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 flex gap-3 justify-end border-t border-gray-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateRulesMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              Update Rules
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
