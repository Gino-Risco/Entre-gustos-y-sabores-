import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

export const Accordion = ({ title, icon: Icon, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="w-full">
      {/* Header del Accordion */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-4 py-2 text-gray-700 hover:bg-gray-100 transition-colors duration-200 rounded-lg"
      >
        <div className="flex items-center gap-3">
          {Icon && <Icon className="w-5 h-5" />}
          <span className="font-medium">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Contenido del Accordion */}
      {isOpen && (
        <div className="mt-1 ml-4 pl-4 border-l-2 border-blue-500">
          {children}
        </div>
      )}
    </div>
  );
};

// Item del Accordion (para cada opción del menú)
export const AccordionItem = ({ to, icon: Icon, label, onClick, active = false }) => {
  return (
    <a
      href={to}
      onClick={(e) => {
        e.preventDefault();
        if (onClick) onClick();
      }}
      className={`flex items-center gap-3 px-4 py-2 rounded-lg transition-colors duration-200 ${
        active
          ? 'bg-blue-600 text-white'
          : 'text-gray-600 hover:bg-blue-50 hover:text-blue-600'
      }`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      <span className="text-sm">{label}</span>
    </a>
  );
};