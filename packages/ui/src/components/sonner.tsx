'use client';

import { Toaster as SonnerToaster } from 'sonner';

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'group toast border border-border bg-white text-foreground shadow-lg rounded-lg text-sm',
          title: 'font-medium',
          description: 'text-muted',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-muted/10 text-foreground',
          error: 'border-red-200 bg-red-50 text-red-900',
          success: 'border-green-200 bg-green-50 text-green-900',
          warning: 'border-amber-200 bg-amber-50 text-amber-900',
          info: 'border-blue-200 bg-blue-50 text-blue-900',
        },
      }}
    />
  );
}

export { toast } from 'sonner';
