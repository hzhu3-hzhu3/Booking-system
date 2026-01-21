import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRooms, useCreateRoom, useUpdateRoom, useArchiveRoom } from '../hooks';
import type { Room, CreateRoomRequest } from '../types';
import { SkeletonLoader } from './SkeletonLoader';

interface RoomManagementModalProps {
  onClose: () => void;
}

type FormMode = 'list' | 'create' | 'edit';

export function RoomManagementModal({ onClose }: RoomManagementModalProps) {
  const [mode, setMode] = useState<FormMode>('list');
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [equipmentInput, setEquipmentInput] = useState('');

  const { data: rooms, isLoading } = useRooms();
  const createRoomMutation = useCreateRoom();
  const updateRoomMutation = useUpdateRoom();
  const archiveRoomMutation = useArchiveRoom();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<CreateRoomRequest>({
    defaultValues: {
      name: '',
      capacity: 1,
      equipment: [],
      status: 'active',
    },
  });

  const equipment = watch('equipment') || [];

  const handleAddEquipment = () => {
    if (equipmentInput.trim()) {
      setValue('equipment', [...equipment, equipmentInput.trim()]);
      setEquipmentInput('');
    }
  };

  const handleRemoveEquipment = (index: number) => {
    setValue('equipment', equipment.filter((_, i) => i !== index));
  };

  const handleCreateRoom = async (data: CreateRoomRequest) => {
    await createRoomMutation.mutateAsync(data);
    reset();
    setMode('list');
  };

  const handleUpdateRoom = async (data: CreateRoomRequest) => {
    if (!selectedRoom) return;
    await updateRoomMutation.mutateAsync({ id: selectedRoom.id, data });
    reset();
    setSelectedRoom(null);
    setMode('list');
  };

  const handleEditRoom = (room: Room) => {
    setSelectedRoom(room);
    setValue('name', room.name);
    setValue('capacity', room.capacity);
    setValue('equipment', room.equipment);
    setValue('status', room.status);
    setMode('edit');
  };

  const handleArchiveRoom = async (roomId: string) => {
    if (confirm('Are you sure you want to archive this room? It will no longer be available for new bookings.')) {
      await archiveRoomMutation.mutateAsync(roomId);
    }
  };

  const handleCancel = () => {
    reset();
    setSelectedRoom(null);
    setMode('list');
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'create' ? 'Create Room' : mode === 'edit' ? 'Edit Room' : 'Manage Rooms'}
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
              <div className="mb-4">
                <button
                  onClick={() => setMode('create')}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700"
                >
                  Create New Room
                </button>
              </div>

              {isLoading ? (
                <div className="space-y-3">
                  <SkeletonLoader variant="card" count={3} />
                </div>
              ) : rooms && rooms.length > 0 ? (
                <div className="space-y-3">
                  {rooms.map((room) => (
                    <div
                      key={room.id}
                      className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition"
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">{room.name}</h3>
                          <p className="text-sm text-gray-600 mt-1">
                            Capacity: {room.capacity} | Status:{' '}
                            <span
                              className={`font-medium ${
                                room.status === 'active'
                                  ? 'text-green-600'
                                  : room.status === 'maintenance'
                                  ? 'text-yellow-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {room.status}
                            </span>
                          </p>
                          {room.equipment.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {room.equipment.map((eq, idx) => (
                                <span
                                  key={idx}
                                  className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded"
                                >
                                  {eq}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 ml-4">
                          <button
                            onClick={() => handleEditRoom(room)}
                            className="px-3 py-1 text-sm text-indigo-600 hover:text-indigo-800"
                          >
                            Edit
                          </button>
                          {room.status !== 'archived' && (
                            <button
                              onClick={() => handleArchiveRoom(room.id)}
                              className="px-3 py-1 text-sm text-red-600 hover:text-red-800"
                            >
                              Archive
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-600">No rooms found</div>
              )}
            </>
          )}

          {(mode === 'create' || mode === 'edit') && (
            <form onSubmit={handleSubmit(mode === 'create' ? handleCreateRoom : handleUpdateRoom)}>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Room Name
                  </label>
                  <input
                    type="text"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('name', { required: 'Room name is required' })}
                  />
                  {errors.name && (
                    <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Capacity
                  </label>
                  <input
                    type="number"
                    min="1"
                    className={`w-full px-3 py-2 border rounded-md ${
                      errors.capacity ? 'border-red-300' : 'border-gray-300'
                    }`}
                    {...register('capacity', {
                      required: 'Capacity is required',
                      min: { value: 1, message: 'Capacity must be at least 1' },
                      valueAsNumber: true,
                    })}
                  />
                  {errors.capacity && (
                    <p className="mt-1 text-sm text-red-600">{errors.capacity.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    {...register('status')}
                  >
                    <option value="active">Active</option>
                    <option value="maintenance">Maintenance</option>
                    <option value="archived">Archived</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Equipment
                  </label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={equipmentInput}
                      onChange={(e) => setEquipmentInput(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddEquipment();
                        }
                      }}
                      placeholder="Add equipment tag"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <button
                      type="button"
                      onClick={handleAddEquipment}
                      className="px-4 py-2 text-sm font-medium text-white bg-gray-600 rounded-md hover:bg-gray-700"
                    >
                      Add
                    </button>
                  </div>
                  {equipment.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {equipment.map((eq, idx) => (
                        <span
                          key={idx}
                          className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm flex items-center gap-2"
                        >
                          {eq}
                          <button
                            type="button"
                            onClick={() => handleRemoveEquipment(idx)}
                            className="text-indigo-600 hover:text-indigo-800 font-bold"
                          >
                            &times;
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
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
                  disabled={createRoomMutation.isPending || updateRoomMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50"
                >
                  {mode === 'create' ? 'Create Room' : 'Update Room'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
