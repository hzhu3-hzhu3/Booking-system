// Export all custom hooks from this file
// Hooks will be added as we implement features

import { useContext } from 'react';
import { AuthContext } from '../contexts/auth.context';

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export { useSearchRooms } from './useSearchRooms';
export { useRules } from './useRules';
export { useCreateBooking } from './useCreateBooking';
export { useMyBookings } from './useMyBookings';
export { useCancelBooking } from './useCancelBooking';
export { useRooms } from './useRooms';
export { useCreateRoom } from './useCreateRoom';
export { useUpdateRoom } from './useUpdateRoom';
export { useArchiveRoom } from './useArchiveRoom';
export { useMaintenanceBlocks } from './useMaintenanceBlocks';
export { useCreateMaintenanceBlock } from './useCreateMaintenanceBlock';
export { useDeleteMaintenanceBlock } from './useDeleteMaintenanceBlock';
export { useUpdateRules } from './useUpdateRules';
export { useAllBookings } from './useAllBookings';
export { useDebounce } from './useDebounce';
