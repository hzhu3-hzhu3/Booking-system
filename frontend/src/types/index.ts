// User types
export type Role = 'user' | 'admin';

export interface User {
  id: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// Room types
export type RoomStatus = 'active' | 'maintenance' | 'archived';

export interface Room {
  id: string;
  name: string;
  capacity: number;
  equipment: string[];
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoomAvailability extends Room {
  availabilityStatus: 'available' | 'partially_available' | 'unavailable' | 'maintenance';
  availableSlots?: TimeSlot[];
}

// Booking types
export type BookingStatus = 'confirmed' | 'cancelled' | 'expired';

export interface Booking {
  id: string;
  userId: string;
  roomId: string;
  roomName?: string;
  startAt: string;
  endAt: string;
  status: BookingStatus;
  cancelledAt?: string;
  cancelledBy?: string;
  createdAt: string;
  updatedAt: string;
  canCancel?: boolean;
}

// Search types
export interface SearchCriteria {
  date: Date;
  startTime: string; // HH:mm format
  endTime: string;   // HH:mm format
  minCapacity?: number;
  equipmentTags?: string[];
}

export interface TimeSlot {
  startAt: string;
  endAt: string;
}

// Maintenance types
export interface MaintenanceBlock {
  id: string;
  roomId: string;
  startAt: string;
  endAt: string;
  reason?: string;
  createdAt: string;
  updatedAt: string;
}

// Rule configuration types
export interface RuleConfig {
  id: number;
  openHour: number;
  closeHour: number;
  timeSlotIntervalMinutes: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
  maxActiveBookings: number;
  maxConsecutive?: number;
  cooldownMinutes?: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  createdAt: string;
  updatedAt: string;
}

// API Error types
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
    field?: string;
  };
  timestamp: string;
  path: string;
}

// Request types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
}

export interface CreateBookingRequest {
  roomId: string;
  startAt: string;
  endAt: string;
}

export interface CreateRoomRequest {
  name: string;
  capacity: number;
  equipment: string[];
  status: RoomStatus;
}

export interface UpdateRoomRequest {
  name?: string;
  capacity?: number;
  equipment?: string[];
  status?: RoomStatus;
}

export interface CreateMaintenanceBlockRequest {
  roomId: string;
  startAt: string;
  endAt: string;
  reason: string;
}

export interface UpdateRuleConfigRequest {
  openHour?: number;
  closeHour?: number;
  timeSlotIntervalMinutes?: number;
  minDurationMinutes?: number;
  maxDurationMinutes?: number;
  maxActiveBookings?: number;
  maxConsecutive?: number;
  cooldownMinutes?: number;
  minNoticeMinutes?: number;
  maxDaysAhead?: number;
}
