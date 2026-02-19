'use client';

type LoadingSkeletonProps = {
  lines?: number;
  className?: string;
};

export function LoadingSkeleton({ lines = 3, className }: LoadingSkeletonProps) {
  return (
    <div className={`animate-pulse rounded-xl border border-border bg-white p-4 ${className ?? ''}`}>
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`h-3 rounded bg-slate-200/80 ${
              index === 0 ? 'w-2/3' : index === lines - 1 ? 'w-1/2' : 'w-full'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
