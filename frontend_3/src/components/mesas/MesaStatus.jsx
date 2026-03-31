import { cn } from '@/lib/utils';

const statusConfig = {
  libre: {
    label: 'Libre',
    color: 'bg-green-500',
    textColor: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    icon: '🟢'
  },
  ocupada: {
    label: 'Ocupada',
    color: 'bg-red-500',
    textColor: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    icon: '🔴'
  },
  reservada: {
    label: 'Reservada',
    color: 'bg-yellow-500',
    textColor: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    icon: '🟡'
  },
  mantenimiento: {
    label: 'Mantenimiento',
    color: 'bg-gray-500',
    textColor: 'text-gray-600',
    bgColor: 'bg-gray-50',
    borderColor: 'border-gray-200',
    icon: '⚫'
  }
};

export const MesaStatus = ({ estado, showLabel = true }) => {
  const config = statusConfig[estado] || statusConfig.libre;

  return (
    <div className="flex items-center gap-2">
      <div className={cn("h-3 w-3 rounded-full", config.color)} />
      {showLabel && (
        <span className={cn("text-sm font-medium", config.textColor)}>
          {config.label}
        </span>
      )}
    </div>
  );
};

export { statusConfig };