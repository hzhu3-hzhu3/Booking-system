import { useState } from 'react';
import { useAuth } from '../hooks';
import { RoomManagementModal } from './RoomManagementModal';
import { MaintenanceBlockModal } from './MaintenanceBlockModal';
import { RuleConfigModal } from './RuleConfigModal';
import { AllBookingsView } from './AllBookingsView';

interface AdminControlsProps {
  isAdminMode: boolean;
  onToggleAdminMode: () => void;
}

export function AdminControls({ isAdminMode, onToggleAdminMode }: AdminControlsProps) {
  const { user } = useAuth();
  const [showRoomModal, setShowRoomModal] = useState(false);
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [showRuleModal, setShowRuleModal] = useState(false);
  const [showAllBookings, setShowAllBookings] = useState(false);

  // Only render for admin users
  if (user?.role !== 'admin') {
    return null;
  }

  return (
    <>
      <div className="bg-white rounded-lg shadow p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Admin Controls</h2>
          <label className="flex items-center cursor-pointer touch-manipulation">
            <span className="mr-3 text-sm font-medium text-gray-700">Admin Mode</span>
            <div className="relative">
              <input
                type="checkbox"
                className="sr-only"
                checked={isAdminMode}
                onChange={onToggleAdminMode}
              />
              <div
                className={`block w-14 h-8 rounded-full transition ${
                  isAdminMode ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              ></div>
              <div
                className={`absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition transform ${
                  isAdminMode ? 'translate-x-6' : ''
                }`}
              ></div>
            </div>
          </label>
        </div>

        {isAdminMode && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            <button
              onClick={() => setShowRoomModal(true)}
              className="px-4 py-3 sm:py-2 text-sm sm:text-base font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
            >
              Manage Rooms
            </button>
            <button
              onClick={() => setShowMaintenanceModal(true)}
              className="px-4 py-3 sm:py-2 text-sm sm:text-base font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
            >
              Maintenance Blocks
            </button>
            <button
              onClick={() => setShowRuleModal(true)}
              className="px-4 py-3 sm:py-2 text-sm sm:text-base font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
            >
              Configure Rules
            </button>
            <button
              onClick={() => setShowAllBookings(true)}
              className="px-4 py-3 sm:py-2 text-sm sm:text-base font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 touch-manipulation"
            >
              View All Bookings
            </button>
          </div>
        )}
      </div>

      {/* Modals */}
      {showRoomModal && <RoomManagementModal onClose={() => setShowRoomModal(false)} />}
      {showMaintenanceModal && <MaintenanceBlockModal onClose={() => setShowMaintenanceModal(false)} />}
      {showRuleModal && <RuleConfigModal onClose={() => setShowRuleModal(false)} />}
      {showAllBookings && <AllBookingsView onClose={() => setShowAllBookings(false)} />}
    </>
  );
}
