import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { format } from 'date-fns';
import {
  useRooms,
  useMaintenanceBlocks,
  useCreateMaintenanceBlock,
  useDeleteMaintenanceBlock,
} from '../hooks';
import type { CreateMaintenanceBlockRequest } from '../types';
import { SkeletonLoader } from './SkeletonLoader';

interface MaintenanceBlockModalProps {
  onClose: () => void;
}

type FormMode = 'list' | 'create';

export function MaintenanceBlockModal({ onClose }: MaintenanceBlockModalProps) {
  const [mode, setMode] = useState<FormMode>('list');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');

  const { data: rooms } = useRooms();
  const { data: blocks, isLoading } = useMaintenanceBlocks(
    selectedRoomId ? { roomId: selectedRoomId } : undefined
  );
  const createBlockMutation = useCreateMaintenanceBlock();
  const deleteBlockMutation = useDeleteMaintenanceBlock();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<CreateMaintenanceBlockRequest & { date: string; startTime: string; endTime: string }>({
    defaultValues: {
      roomId: '',
      date: '',
      startTime: '',
      endTime: '',
      reason: '',
    },
  });

  const watchRoomId = watch('roomId');

  const handleCreateBlock = async (data: CreateMaintenanceBlockRequest & { date: string; startTime: string; endTime: string }) => {
    // Combine date and time into ISO strings
    const startAt = new Date(`${data.date}T${data.startTime}`).toISOString();
    const endAt = new Date(`${data.date}T${data.endTime}`).toISOString();

    const payload: CreateMaintenanceBlockRequest = {
      roomId: data.roomId,
      startAt,
      endAt,
      reason: data.reason,
    };

    await createBlockMutation.mutateAsync(payload);
    reset();
    setMode('list');
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (confirm('Are you sure you want to delete this maintenance block? This will make the time slot available for bookings.')) {
      await deleteBlockMutation.mutateAsync(blockId);
    }
  };

  const handleCancel = () => {
    reset();
    setMode('list');
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), 'MMM dd, yyyy HH:mm');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create Maintenance Block' : 'Maintenance Blocks'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6">
          {mode === 'list' && (
            <>
              <div className="mb-4 flex gap-3">
                <button
                  onClick={() => setMode('create')}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  Create Maintenance Block
                </button>
                <select
                  value={selectedRoomId}
                  onChange={(e) => setSelectedRoomId(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">All Rooms</option>
                  {rooms?.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <SkeletonLoader variant="card" count={3} />
                </div>
              ) : blocks && blocks.length > 0 ? (
                <div className="space-y-3">
                  {blocks.map((block) => {
                    const room = rooms?.find((r) => r.id === block.roomId);
                    return (
                      <div
                        key={block.id}
                        className="border border-gray-200 rounded-lg p-4 hover:border-yellow-300 transition"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold text-gray-900">
                              {room?.name || 'Unknown Room'}
                            </h3>
                            <p className="text-sm text-gray-600 mt-1">
                              {formatDateTime(block.startAt)} - {formatDateTime(block.endAt)}
                            </p>
                            {block.reason && (
                              <p className="text-sm text-gray-700 mt-2 italic">{block.reason}</p>
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteBlock(block.id)}
                            className="px-3 py-1 text-sm text-red-600 hover:text-red-800 ml-4"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">
                  No maintenance blocks found
                  {selectedRoomId && ' for this room'}
                </div>
              )}
            </>
          )}

          {mode === 'create' && (
            <form onSubmit={handleSubmit(handleCreateBlock)}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Room</label>
                  <select
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.roomId ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('roomId', { required: 'Room is required' })}
                  >
                    <option value="">Select a room</option>
                    {rooms?.map((room) => (
                      <option key={room.id} value={room.id}>
                        {room.name}
                      </option>
                    ))}
                  </select>
                  {errors.roomId && (
                    <p className="mt-1 text-sm text-red-600">{errors.roomId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                  <input
                    type="date"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.date ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('date', { required: 'Date is required' })}
                  />
                  {errors.date && (
                    <p className="mt-1 text-sm text-red-600">{errors.date.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Time
                    </label>
                    <input
                      type="time"
                      className={`w-full px-3 py-2 border rounded-md ${
                        errors.startTime ? 'border-red-300' : 'border-gray-300'
                      }`}
                      {...register('startTime', { required: 'Start time is required' })}
                    />
                    {errors.startTime && (
                      <p className="mt-1 text-sm text-red-600">{errors.startTime.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Time
                    </label>
                    <input
                      type="time"
                      className={`w-full px-3 py-2 border rounded-md ${
                        errors.endTime ? 'border-red-300' : 'border-gray-300'
                      }`}
                      {...register('endTime', { required: 'End time is required' })}
                    />
                    {errors.endTime && (
                      <p className="mt-1 text-sm text-red-600">{errors.endTime.message}</p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                  <textarea
                    rows={3}
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.reason ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Describe the maintenance work..."
                    {...register('reason', { required: 'Reason is required' })}
                  />
                  {errors.reason && (
                    <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
                  )}
                </div>

                {watchRoomId && (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                    <p className="text-sm text-yellow-800">
                      <strong>Warning:</strong> Creating a maintenance block will prevent new bookings
                      during this time. If there are existing bookings, they will remain but the room
                      will show as unavailable for new reservations.
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-6 flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createBlockMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  Create Maintenance Block
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
