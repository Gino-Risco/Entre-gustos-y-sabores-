import { Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const CategoriaList = ({ categorias, onEdit, onDelete, isLoading }) => {
  if (!categorias || categorias.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay categorías registradas</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Nombre</th>
            <th className="text-left py-3 px-4 font-semibold text-gray-900">Descripción</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-900">Color</th>
            <th className="text-center py-3 px-4 font-semibold text-gray-900">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {categorias.map((categoria) => (
            <tr key={categoria.id} className="hover:bg-gray-50 transition-colors">
              <td className="py-3 px-4">
                <span className="font-medium text-gray-900">{categoria.nombre}</span>
              </td>
              <td className="py-3 px-4">
                <span className="text-sm text-gray-500">{categoria.descripcion || '-'}</span>
              </td>
              <td className="py-3 px-4 text-center">
                <div
                  className="w-8 h-8 rounded-full mx-auto border-2 border-gray-300 shadow-sm"
                  style={{ backgroundColor: categoria.color || '#cccccc' }}
                  title={categoria.color || 'Sin color'}
                />
              </td>
              <td className="py-3 px-4 text-center">
                <div className="flex gap-2 justify-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(categoria)}
                    disabled={isLoading}
                    className="hover:bg-blue-50 hover:border-blue-300"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(categoria)}
                    disabled={isLoading}
                    className="hover:bg-red-50 hover:border-red-300 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};