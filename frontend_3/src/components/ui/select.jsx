// src/components/ui/select.jsx
import { cn } from '@/lib/utils';
import { ChevronDown } from 'lucide-react';
import { useState, createContext, useContext } from 'react';

const SelectContext = createContext();

export const Select = ({ value, onValueChange, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <SelectContext.Provider value={{ value, onValueChange, isOpen, setIsOpen }}>
      <div className="relative w-full">
        {children}
      </div>
    </SelectContext.Provider>
  );
};

export const SelectTrigger = ({ className, children, onClick }) => {
  const { isOpen, setIsOpen, value } = useContext(SelectContext);
  
  return (
    <button
      type="button"
      onClick={() => {
        setIsOpen(!isOpen);
        onClick?.();
      }}
      className={cn(
        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
    >
      <span className={value ? "text-gray-900" : "text-gray-500"}>
        {children}
      </span>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </button>
  );
};

export const SelectValue = ({ placeholder }) => {
  const { value } = useContext(SelectContext);
  
  // Si hay valor, muéstralo; si no, muestra placeholder
  return (
    <span className={value ? "text-gray-900 font-medium" : "text-gray-500"}>
      {value || placeholder}
    </span>
  );
};

export const SelectContent = ({ className, children }) => {
  const { isOpen } = useContext(SelectContext);
  
  if (!isOpen) return null;
  
  return (
    <div className={cn(
      "absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto",
      className
    )}>
      {children}
    </div>
  );
};

export const SelectItem = ({ value, children }) => {
  const { onValueChange, setIsOpen } = useContext(SelectContext);
  
  return (
    <button
      type="button"
      onClick={() => {
        onValueChange(value);
        setIsOpen(false);
      }}
      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-100 transition-colors"
    >
      {children}
    </button>
  );
};