// src/components/ui/dropdown-menu.jsx
import { useState, createContext, useContext, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';

const DropdownMenuContext = createContext();

export const DropdownMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef();

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ isOpen, setIsOpen }}>
      <div ref={ref} className="relative">{children}</div>
    </DropdownMenuContext.Provider>
  );
};

export const DropdownMenuTrigger = ({ children, asChild }) => {
  const { isOpen, setIsOpen } = useContext(DropdownMenuContext);

  return (
    <div onClick={(e) => {
      e.stopPropagation();
      setIsOpen(!isOpen);
    }}>
      {children}
    </div>
  );
};

export const DropdownMenuContent = ({ className, align = 'end', children }) => {
  const { isOpen, setIsOpen } = useContext(DropdownMenuContext);

  if (!isOpen) return null;

  const alignmentClasses = {
    start: 'left-0',
    end: 'right-0',
    center: 'left-1/2 -translate-x-1/2'
  };

  return (
    <div
      className={cn(
        'absolute z-50 mt-2 w-56 rounded-md border bg-white shadow-lg',
        alignmentClasses[align] || alignmentClasses.end,
        className
      )}
    >
      {children}
    </div>
  );
};

export const DropdownMenuLabel = ({ className, children }) => {
  return (
    <div className={cn('px-4 py-2 text-sm font-semibold text-gray-900 border-b', className)}>
      {children}
    </div>
  );
};

export const DropdownMenuSeparator = ({ className }) => {
  return <div className={cn('my-1 h-px bg-gray-200', className)} />;
};

export const DropdownMenuItem = ({ className, children, onClick }) => {
  const { setIsOpen } = useContext(DropdownMenuContext);

  const handleClick = (e) => {
    if (onClick) onClick(e);
    setIsOpen(false); // Cerrar al hacer clic
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors',
        className
      )}
    >
      {children}
    </button>
  );
};

export default DropdownMenu;