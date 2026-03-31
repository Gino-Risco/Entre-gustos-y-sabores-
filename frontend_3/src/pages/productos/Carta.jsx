import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, Image as ImageIcon, ChevronLeft, ChevronRight, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { productosService } from '@/services/productos.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const Carta = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [incluirInactivos, setIncluirInactivos] = useState(false);

  // ESTADOS DE PAGINACIÓN
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const toNumber = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  const { data: productos, isLoading } = useQuery({
    queryKey: ['productos-carta'],
    queryFn: async () => {
      // Pedimos todos, pero filtramos localmente SOLO los "preparados" 
      // (Si tu backend soportara el filtro "?tipo=preparado", lo pondríamos ahí para optimizar)
      const data = await productosService.getAll({ incluir_inactivos: true });
      return data
        .filter(p => p.tipo === 'preparado') // 👈 FILTRO CLAVE PARA LA CARTA
        .map(p => ({
          ...p,
          precio_venta: parseFloat(p.precio_venta) || 0,
          imagen_url: p.imagen_url || null
        }));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => await productosService.delete(id),
    onSuccess: () => { queryClient.invalidateQueries(['productos-carta']); toast.success('Plato eliminado de la carta'); },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Error al eliminar'),
  });

  const toggleActivoMutation = useMutation({
    mutationFn: async ({ id, activo }) => await productosService.toggleActivo(id, activo),
    onSuccess: (data) => { queryClient.invalidateQueries(['productos-carta']); toast.success(data.activo ? 'Activado' : 'Desactivado'); },
  });

  const toggleMenuMutation = useMutation({
    mutationFn: async ({ id, disponible_en_menu }) => await productosService.toggleDisponibleEnMenu(id, disponible_en_menu),
    onSuccess: () => { queryClient.invalidateQueries(['productos-carta']); toast.success('Menú actualizado'); },
  });

  // Filtros
  const filteredProductos = productos?.filter((prod) => {
    const matchesSearch = prod.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesActivo = incluirInactivos || prod.activo;
    return matchesSearch && matchesActivo;
  }) || [];

  // Resetear a página 1 si cambian los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, incluirInactivos]);

  // CÁLCULOS DE PAGINACIÓN
  const totalItems = filteredProductos.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProductos = filteredProductos.slice(startIndex, startIndex + itemsPerPage);

  const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
  const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

  const handleDelete = (producto) => {
    if (window.confirm(`¿Estás seguro de eliminar "${producto.nombre}" de la carta?`)) {
      deleteMutation.mutate(producto.id);
    }
  };

  const stats = {
    total: productos?.length || 0,
    enMenu: productos?.filter(p => p.disponible_en_menu).length || 0,
    inactivos: productos?.filter(p => !p.activo).length || 0,
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Utensils className="h-8 w-8 text-cyan-600" /> Carta y Platos
          </h1>
          <p className="text-gray-500 mt-1">Gestión de platillos preparados y menú del día</p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
            <input type="checkbox" checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} className="rounded text-cyan-600 w-4 h-4 cursor-pointer" />
            Mostrar inactivos
          </label>
          <Button onClick={() => navigate('/productos/carta/crear')} className="bg-cyan-600 hover:bg-cyan-700">
            <Plus className="h-5 w-5 mr-2" /> Nuevo Plato
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Platos en Carta</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">En Menú del Día</p><p className="text-2xl font-bold text-purple-600">{stats.enMenu}</p></CardContent></Card>
        <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Platos Inactivos</p><p className="text-2xl font-bold text-red-600">{stats.inactivos}</p></CardContent></Card>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <Input placeholder="Buscar plato por nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 border-cyan-200 focus-visible:ring-cyan-500" />
        </div>
      </div>

      <Card>
        <CardContent className="p-0 flex flex-col min-h-[400px]">
          {isLoading ? (
            <div className="flex flex-1 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-600"></div></div>
          ) : filteredProductos?.length === 0 ? (
            <div className="py-12 flex-1 text-center"><p className="text-gray-500">No se encontraron platos en la carta</p></div>
          ) : (
            <>
              <div className="overflow-x-auto flex-1">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">Platillo</th>
                      <th className="text-left py-4 px-6 font-semibold text-gray-900">Categoría</th>
                      <th className="text-right py-4 px-6 font-semibold text-gray-900">Precio Lista</th>
                      <th className="text-center py-4 px-6 font-semibold text-gray-900">Menú del Día</th>
                      <th className="text-center py-4 px-6 font-semibold text-gray-900">Visible</th>
                      <th className="text-center py-4 px-6 font-semibold text-gray-900">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {currentProductos.map((producto) => (
                      <tr key={producto.id} className={`hover:bg-gray-50 transition-colors ${!producto.activo ? 'opacity-60 bg-gray-50' : ''}`}>
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-4">
                            {producto.imagen_url ? (
                              <img src={producto.imagen_url} alt={producto.nombre} className="w-12 h-12 rounded-lg object-cover border border-gray-200 bg-white" />
                            ) : (
                              <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center border border-gray-200">
                                <ImageIcon className="h-6 w-6 text-gray-400" />
                              </div>
                            )}
                            <div>
                              <p className="font-medium text-gray-900">{producto.nombre}</p>
                              {producto.descripcion && <p className="text-sm text-gray-500 truncate max-w-xs">{producto.descripcion}</p>}
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-sm text-gray-700">
                          <Badge variant="outline" className="bg-cyan-50 text-cyan-800 border-cyan-200">{producto.categoria_nombre || '-'}</Badge>
                        </td>
                        <td className="py-4 px-6 text-right font-semibold text-gray-900">
                          S/ {toNumber(producto.precio_venta).toFixed(2)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          {producto.categoria_nombre === 'Entradas' || producto.categoria_nombre === 'Platos de Fondo' ? (
                            <input type="checkbox" checked={producto.disponible_en_menu || false} onChange={() => toggleMenuMutation.mutate({ id: producto.id, disponible_en_menu: !producto.disponible_en_menu })} className="rounded cursor-pointer h-4 w-4 text-purple-600 focus:ring-purple-500"/>
                          ) : (<span className="text-gray-400 text-xs">N/A</span>)}
                        </td>
                        <td className="py-4 px-6 text-center">
                          <input type="checkbox" checked={producto.activo} onChange={() => toggleActivoMutation.mutate({ id: producto.id, activo: !producto.activo })} className="rounded cursor-pointer h-4 w-4 text-cyan-600 focus:ring-cyan-500"/>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <div className="flex justify-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => navigate(`/productos/editar/${producto.id}`)} className="hover:bg-cyan-100 hover:text-cyan-700">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(producto)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* FOOTER DE PAGINACIÓN */}
              <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4 rounded-b-lg">
                <div className="text-sm text-gray-500">
                  Mostrando <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span> a <span className="font-medium">{Math.min(startIndex + itemsPerPage, totalItems)}</span> de <span className="font-medium">{totalItems}</span> platillos
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handlePrevPage} disabled={currentPage === 1} className="flex items-center gap-1">
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <div className="flex items-center px-3 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-md">
                    Página {currentPage} de {totalPages || 1}
                  </div>
                  <Button variant="outline" size="sm" onClick={handleNextPage} disabled={currentPage === totalPages || totalPages === 0} className="flex items-center gap-1">
                    Siguiente <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};