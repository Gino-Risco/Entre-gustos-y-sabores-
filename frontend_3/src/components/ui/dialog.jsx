// src/components/ui/dialog.jsx
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

export const Dialog = ({ open, onOpenChange, children }) => {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div 
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />
      
      {/* Content */}
      <div className="relative z-50 w-full max-w-lg mx-4">
        {children}
      </div>
    </div>,
    document.body
  );
};

export const DialogContent = ({ className, children, onOpenChange }) => {
  return (
    <div className={cn(
      "bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden",
      className
    )}>
      <button
        onClick={() => onOpenChange(false)}
        className="absolute top-4 right-4 p-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <X className="h-5 w-5 text-gray-500" />
      </button>
      {children}
    </div>
  );
};

export const DialogHeader = ({ className, children }) => {
  return (
    <div className={cn("px-6 py-4 border-b border-gray-200", className)}>
      {children}
    </div>
  );
};

export const DialogTitle = ({ className, children }) => {
  return (
    <h2 className={cn("text-xl font-semibold text-gray-900", className)}>
      {children}
    </h2>
  );
};

export const DialogFooter = ({ className, children }) => {
  return (
    <div className={cn("px-6 py-4 border-t border-gray-200 flex gap-2 justify-end", className)}>
      {children}
    </div>
  );
};