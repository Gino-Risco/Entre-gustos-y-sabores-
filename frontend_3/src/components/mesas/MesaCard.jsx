import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MesaStatus } from './MesaStatus';

export const MesaCard = ({ mesa, onClick, onNuevaOrden, isLoading }) => {
  const { id, numero, capacidad, estado, ubicacion, ordenes_activas } = mesa;

  const getStatusColor = () => {
    switch (estado) {
      case 'libre': return 'bg-white border-green-200 hover:border-green-400 hover:shadow-green-200';
      case 'ocupada': return 'bg-red-50 border-red-300 hover:border-red-500 hover:shadow-red-200';
      case 'reservada': return 'bg-yellow-50 border-yellow-300 hover:border-yellow-500 hover:shadow-yellow-200';
      case 'mantenimiento': return 'bg-gray-50 border-gray-300 hover:border-gray-500 hover:shadow-gray-200';
      default: return 'bg-white border-gray-200';
    }
  };

  return (
    <div
      onClick={() => onClick(mesa)}
      className={cn(
        "relative rounded-xl border-2 p-6 cursor-pointer transition-all duration-300 hover:shadow-lg",
        getStatusColor()
      )}
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-2xl font-bold text-gray-900">Mesa {numero}</h3>
          {ubicacion && <p className="text-sm text-gray-500 mt-1">{ubicacion}</p>}
        </div>
        {/* ELIMINAMOS EL DROPDOWN DE LOS 3 PUNTITOS DE AQUÍ */}
      </div>

      <div className="mb-4">
        <MesaStatus estado={estado} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Users className="h-4 w-4" />
          <span>{capacidad} personas</span>
        </div>
        
        {ordenes_activas > 0 && (
          <div className="flex items-center gap-2 text-sm text-red-600 font-medium">
            <span>📋 {ordenes_activas} orden(es) activa(s)</span>
          </div>
        )}
      </div>

      {estado === 'libre' && (
        <button
          onClick={(e) => {
            e.stopPropagation(); // Evita que al hacer clic en el botón se abra el detalle de la mesa
            if (onNuevaOrden) {
              onNuevaOrden(mesa);
            }
          }}
          disabled={isLoading}
          className="mt-4 w-full py-2 px-4 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Creando...' : 'Nueva Orden'}
        </button>
      )}

      {estado === 'ocupada' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onClick(mesa);
          }}
          className="mt-4 w-full py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
        >
          Ver Orden
        </button>
      )}
    </div>
  );
};