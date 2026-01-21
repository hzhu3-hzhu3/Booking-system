interface SkeletonLoaderProps {
  variant?: 'card' | 'text' | 'circle' | 'button';
  count?: number;
  className?: string;
}

export function SkeletonLoader({ variant = 'card', count = 1, className = '' }: SkeletonLoaderProps) {
  const baseClasses = 'animate-pulse bg-gray-200 rounded';

  const getVariantClasses = () => {
    switch (variant) {
      case 'card':
        return 'h-32 w-full';
      case 'text':
        return 'h-4 w-full';
      case 'circle':
        return 'h-12 w-12 rounded-full';
      case 'button':
        return 'h-10 w-24';
      default:
        return 'h-32 w-full';
    }
  };

  const items = Array.from({ length: count }, (_, i) => i);

  return (
    <>
      {items.map((i) => (
        <div key={i} className={`${baseClasses} ${getVariantClasses()} ${className}`} />
      ))}
    </>
  );
}

// Specific skeleton components for common use cases
export function RoomCardSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <SkeletonLoader variant="text" className="h-6 w-3/4" />
          <SkeletonLoader variant="text" className="h-4 w-1/2" />
        </div>
        <SkeletonLoader variant="button" className="h-8 w-24" />
      </div>
      <div className="flex flex-wrap gap-2 mb-3">
        <SkeletonLoader variant="button" count={3} className="h-6 w-16" />
      </div>
      <SkeletonLoader variant="button" className="w-full h-10" />
    </div>
  );
}

export function BookingCardSkeleton() {
  return (
    <div className="border border-gray-200 rounded-lg p-3 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-3">
        <div className="flex-1 space-y-2">
          <SkeletonLoader variant="text" className="h-6 w-2/3" />
          <SkeletonLoader variant="text" className="h-4 w-1/2" />
          <SkeletonLoader variant="text" className="h-4 w-1/3" />
        </div>
        <SkeletonLoader variant="button" className="h-8 w-20" />
      </div>
      <SkeletonLoader variant="button" className="w-full h-10" />
    </div>
  );
}
