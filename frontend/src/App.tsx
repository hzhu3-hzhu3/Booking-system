import { useState, lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { AuthProvider } from './contexts/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Login } from './components/Login';
import { Register } from './components/Register';
import { SearchPanel } from './components/SearchPanel';
import { RoomResultsPanel } from './components/RoomResultsPanel';
import { MyBookingsPanel } from './components/MyBookingsPanel';
import { useAuth, useSearchRooms, useRules, useMyBookings, useCancelBooking } from './hooks';
import type { SearchCriteria } from './types';

// Lazy load admin components
const AdminControls = lazy(() => import('./components/AdminControls').then(module => ({ default: module.AdminControls })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
      gcTime: 10 * 60 * 1000, // 10 minutes (formerly cacheTime)
    },
    mutations: {
      retry: false,
    },
  },
});

function AppContent() {
  const { isAuthenticated, isLoading, login, register, logout, user } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [searchCriteria, setSearchCriteria] = useState<SearchCriteria | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const queryClient = useQueryClient();

  const handleSearch = (criteria: SearchCriteria) => {
    setSearchCriteria(criteria);
  };

  const handleBookingSuccess = () => {
    // Invalidate search results to force refetch
    queryClient.invalidateQueries({ queryKey: ['rooms', 'search'] });
    queryClient.invalidateQueries({ queryKey: ['bookings', 'my'] });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (showRegister) {
      return (
        <Register
          onRegister={register}
          onSwitchToLogin={() => setShowRegister(false)}
        />
      );
    }
    return (
      <Login
        onLogin={login}
        onSwitchToRegister={() => setShowRegister(true)}
      />
    );
  }

  // Only render authenticated content when logged in
  return <AuthenticatedApp 
    user={user}
    logout={logout}
    searchCriteria={searchCriteria}
    onSearch={handleSearch}
    onBookingSuccess={handleBookingSuccess}
    isAdminMode={isAdminMode}
    setIsAdminMode={setIsAdminMode}
  />;
}

// Separate component for authenticated users
function AuthenticatedApp({ 
  user, 
  logout, 
  searchCriteria, 
  onSearch, 
  onBookingSuccess,
  isAdminMode,
  setIsAdminMode
}: {
  user: any;
  logout: () => void;
  searchCriteria: SearchCriteria | null;
  onSearch: (criteria: SearchCriteria) => void;
  onBookingSuccess: () => void;
  isAdminMode: boolean;
  setIsAdminMode: (value: boolean) => void;
}) {
  const { data: rules } = useRules();
  const { data: rooms, isLoading: isSearching, error: searchError } = useSearchRooms(searchCriteria);
  const { data: bookings, isLoading: isLoadingBookings, error: bookingsError } = useMyBookings();
  const cancelBookingMutation = useCancelBooking();

  const handleCancelBooking = (bookingId: string) => {
    cancelBookingMutation.mutate(bookingId);
  };

  const handleSearch = (criteria: SearchCriteria) => {
    onSearch(criteria);
  };

  const handleBookingSuccess = () => {
    onBookingSuccess();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-slate-100">
      <header className="fixed top-4 left-4 right-4 z-50 glass-card rounded-2xl">
        <div className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 sm:gap-4">
            <h1 className="text-2xl sm:text-3xl font-heading font-bold text-primary">Breakout Room Booking</h1>
            <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
              {user?.role === 'admin' && (
                <span className="px-3 py-1 text-xs font-medium bg-cta/10 text-cta rounded-full">
                  Admin
                </span>
              )}
              <span className="text-sm text-secondary truncate max-w-[150px] sm:max-w-none">{user?.email}</span>
              <button
                onClick={logout}
                className="btn-primary"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto pt-32 pb-8 px-4 sm:px-6 lg:px-8">
        {/* Admin Controls - Lazy loaded */}
        {user?.role === 'admin' && (
          <Suspense fallback={
            <div className="glass-card rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6">
              <div className="animate-pulse">
                <div className="h-6 bg-gray-200 rounded w-1/4 mb-4"></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                  <div className="h-10 bg-gray-200 rounded"></div>
                </div>
              </div>
            </div>
          }>
            <AdminControls
              isAdminMode={isAdminMode}
              onToggleAdminMode={() => setIsAdminMode(!isAdminMode)}
            />
          </Suspense>
        )}

        {/* Mobile: Stack vertically, Desktop: Side-by-side layout */}
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Search Panel - Full width on mobile, 1/3 on desktop */}
          <div className="w-full lg:col-span-1">
            <SearchPanel 
              onSearch={handleSearch} 
              isLoading={isSearching}
              rules={rules}
            />
          </div>
          
          {/* Results Panel - Full width on mobile, 2/3 on desktop */}
          <div className="w-full lg:col-span-2">
            <RoomResultsPanel
              rooms={rooms}
              searchCriteria={searchCriteria}
              isLoading={isSearching}
              error={searchError}
              onBookingSuccess={handleBookingSuccess}
            />
          </div>

          {/* My Bookings Panel - Full width on mobile, below results */}
          <div className="w-full lg:col-span-3">
            <MyBookingsPanel
              bookings={bookings}
              isLoading={isLoadingBookings}
              error={bookingsError}
              onCancel={handleCancelBooking}
              isCancelling={cancelBookingMutation.isPending}
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
