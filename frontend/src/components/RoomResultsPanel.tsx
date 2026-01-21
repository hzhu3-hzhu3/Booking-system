import { useState } from 'react';
import type { RoomAvailability, SearchCriteria } from '../types';
import { BookingConfirmationModal } from './BookingConfirmationModal';

interface RoomResultsPanelProps {
  rooms: RoomAvailability[] | undefined;
  searchCriteria: SearchCriteria | null;
  isLoading: boolean;
  error: Error | null;
  onBookingSuccess: () => void;
}

// Floor plan layout configuration
const FLOOR_LEVELS = ['Level 1', 'Level 2', 'Level 3'];

// Assign rooms to floors and positions
const getRoomFloorAndPosition = (roomName: string, index: number) => {
  // Simple logic: distribute rooms across floors
  const floorIndex = index % 3;
  const positionInFloor = Math.floor(index / 3);
  
  return {
    floor: FLOOR_LEVELS[floorIndex],
    position: positionInFloor,
  };
};

export function RoomResultsPanel({
  rooms,
  searchCriteria,
  isLoading,
  error,
  onBookingSuccess,
}: RoomResultsPanelProps) {
  const [selectedRoom, setSelectedRoom] = useState<RoomAvailability | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<string>(FLOOR_LEVELS[0]);
  const [hoveredRoom, setHoveredRoom] = useState<string | null>(null);

  const handleRoomClick = (room: RoomAvailability) => {
    if (isBookable(room)) {
      setSelectedRoom(room);
      setShowBookingModal(true);
    }
  };

  const handleCloseModal = () => {
    setShowBookingModal(false);
    setSelectedRoom(null);
  };

  const handleBookingComplete = () => {
    setShowBookingModal(false);
    setSelectedRoom(null);
    onBookingSuccess();
  };

  const isBookable = (room: RoomAvailability) => {
    return room.availabilityStatus === 'available';
  };

  const getRoomColor = (status: RoomAvailability['availabilityStatus']) => {
    switch (status) {
      case 'available':
        return 'bg-green-500 hover:bg-green-600 border-green-600 cursor-pointer';
      case 'partially_available':
        return 'bg-yellow-400 hover:bg-yellow-500 border-yellow-500 cursor-pointer';
      case 'maintenance':
        return 'bg-orange-300 border-orange-400 cursor-not-allowed opacity-60';
      case 'unavailable':
        return 'bg-gray-300 border-gray-400 cursor-not-allowed opacity-60';
      default:
        return 'bg-gray-200 border-gray-300';
    }
  };

  // Group rooms by floor
  const roomsByFloor = rooms?.reduce((acc, room, index) => {
    const { floor } = getRoomFloorAndPosition(room.name, index);
    if (!acc[floor]) acc[floor] = [];
    acc[floor].push(room);
    return acc;
  }, {} as Record<string, RoomAvailability[]>) || {};

  const currentFloorRooms = roomsByFloor[selectedFloor] || [];

  return (
    <div className="bg-white rounded-lg shadow p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
        <h2 className="text-lg sm:text-xl font-semibold text-gray-900">Floor Plan View</h2>
        
        {/* Floor Selector */}
        {rooms && rooms.length > 0 && (
          <div className="flex gap-2">
            {FLOOR_LEVELS.map((floor) => (
              <button
                key={floor}
                onClick={() => setSelectedFloor(floor)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  selectedFloor === floor
                    ? 'bg-indigo-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {floor}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      {rooms && rooms.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-4 text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 border border-green-600 rounded"></div>
            <span className="text-gray-700">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-400 border border-yellow-500 rounded"></div>
            <span className="text-gray-700">Partially Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-300 border border-orange-400 rounded"></div>
            <span className="text-gray-700">Maintenance</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-300 border border-gray-400 rounded"></div>
            <span className="text-gray-700">Unavailable</span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 sm:p-4 mb-3 sm:mb-4">
          <p className="text-sm text-red-800">Error loading rooms: {error.message}</p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      )}

      {/* No Search Criteria */}
      {!isLoading && !error && !searchCriteria && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="mt-3 text-base text-gray-600">Use the search panel to find available rooms.</p>
        </div>
      )}

      {/* No Results */}
      {!isLoading && !error && searchCriteria && rooms && rooms.length === 0 && (
        <div className="text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-3 text-base text-gray-600">No rooms found matching your criteria.</p>
          <p className="mt-1 text-sm text-gray-500">Try adjusting your search filters.</p>
        </div>
      )}

      {/* Floor Plan Layout */}
      {!isLoading && !error && rooms && rooms.length > 0 && (
        <div className="relative">
          {/* Floor Container */}
          <div className="border-4 border-gray-300 rounded-lg p-8 bg-gray-50 min-h-[500px] relative">
            {/* Floor Label */}
            <div className="absolute top-2 left-2 bg-white px-3 py-1 rounded-md shadow-sm border border-gray-200">
              <span className="text-sm font-semibold text-gray-700">{selectedFloor}</span>
            </div>

            {/* Hallway indicator */}
            <div className="absolute inset-0 m-8 border-2 border-dashed border-gray-300 rounded-lg pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium pointer-events-none">
              Hallway
            </div>

            {/* Rooms Layout */}
            <div className="relative h-full">
              {/* Top Row Rooms */}
              <div className="absolute top-0 left-0 right-0 flex justify-around gap-4 px-4">
                {currentFloorRooms.slice(0, Math.ceil(currentFloorRooms.length / 2)).map((room) => (
                  <div key={room.id} className="relative group">
                    <div
                      onClick={() => handleRoomClick(room)}
                      onMouseEnter={() => setHoveredRoom(room.id)}
                      onMouseLeave={() => setHoveredRoom(null)}
                      className={`w-32 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition-all transform hover:scale-105 ${getRoomColor(
                        room.availabilityStatus
                      )} ${selectedRoom?.id === room.id ? 'ring-4 ring-indigo-500' : ''}`}
                    >
                      <span className="text-white font-bold text-lg">{room.name}</span>
                      <span className="text-white text-xs mt-1">👥 {room.capacity}</span>
                    </div>

                    {/* Tooltip */}
                    {hoveredRoom === room.id && (
                      <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
                        <div className="font-semibold mb-1">{room.name}</div>
                        <div className="space-y-1">
                          <div>Capacity: {room.capacity} people</div>
                          <div>Status: {room.availabilityStatus.replace(/_/g, ' ')}</div>
                          {room.equipment && room.equipment.length > 0 && (
                            <div>Equipment: {room.equipment.join(', ')}</div>
                          )}
                        </div>
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-1">
                          <div className="border-4 border-transparent border-t-gray-900"></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Left Column Rooms */}
              <div className="absolute left-0 top-32 bottom-0 flex flex-col justify-around gap-4 py-4">
                {currentFloorRooms.slice(Math.ceil(currentFloorRooms.length / 2)).map((room) => (
                  <div key={room.id} className="relative group">
                    <div
                      onClick={() => handleRoomClick(room)}
                      onMouseEnter={() => setHoveredRoom(room.id)}
                      onMouseLeave={() => setHoveredRoom(null)}
                      className={`w-32 h-24 rounded-lg border-2 flex flex-col items-center justify-center transition-all transform hover:scale-105 ${getRoomColor(
                        room.availabilityStatus
                      )} ${selectedRoom?.id === room.id ? 'ring-4 ring-indigo-500' : ''}`}
                    >
                      <span className="text-white font-bold text-lg">{room.name}</span>
                      <span className="text-white text-xs mt-1">👥 {room.capacity}</span>
                    </div>

                    {/* Tooltip */}
                    {hoveredRoom === room.id && (
                      <div className="absolute z-10 left-full top-1/2 transform -translate-y-1/2 ml-2 w-64 bg-gray-900 text-white text-xs rounded-lg p-3 shadow-lg">
                        <div className="font-semibold mb-1">{room.name}</div>
                        <div className="space-y-1">
                          <div>Capacity: {room.capacity} people</div>
                          <div>Status: {room.availabilityStatus.replace(/_/g, ' ')}</div>
                          {room.equipment && room.equipment.length > 0 && (
                            <div>Equipment: {room.equipment.join(', ')}</div>
                          )}
                        </div>
                        <div className="absolute right-full top-1/2 transform -translate-y-1/2 mr-1">
                          <div className="border-4 border-transparent border-r-gray-900"></div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Room count indicator */}
          <div className="mt-4 text-center text-sm text-gray-600">
            Showing {currentFloorRooms.length} room{currentFloorRooms.length !== 1 ? 's' : ''} on {selectedFloor}
          </div>
        </div>
      )}

      {/* Booking Confirmation Modal */}
      {showBookingModal && selectedRoom && searchCriteria && (
        <BookingConfirmationModal
          room={selectedRoom}
          searchCriteria={searchCriteria}
          onClose={handleCloseModal}
          onSuccess={handleBookingComplete}
        />
      )}
    </div>
  );
}
