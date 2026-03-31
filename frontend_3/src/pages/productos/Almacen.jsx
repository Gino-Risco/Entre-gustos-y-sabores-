import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Edit, Trash2, AlertTriangle, ChevronLeft, ChevronRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { productosService } from '@/services/productos.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const Almacen = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterTipo, setFilterTipo] = useState('todos'); // 'todos', 'insumo', 'empacado'
    const [incluirInactivos, setIncluirInactivos] = useState(false);

    // ESTADOS DE PAGINACIÓN
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const toNumber = (value) => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    };

    const { data: productos, isLoading } = useQuery({
        queryKey: ['productos-almacen'],
        queryFn: async () => {
            // Pedimos todos, pero filtramos localmente SOLO "insumo" y "empacado"
            const data = await productosService.getAll({ incluir_inactivos: true });
            return data
                .filter(p => p.tipo === 'insumo' || p.tipo === 'empacado') // 👈 FILTRO CLAVE PARA ALMACÉN
                .map(p => ({
                    ...p,
                    precio_venta: parseFloat(p.precio_venta) || 0,
                    stock_actual: parseInt(p.stock_actual) || 0,
                    stock_minimo: parseInt(p.stock_minimo) || 0,
                }));
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id) => await productosService.delete(id),
        onSuccess: () => { queryClient.invalidateQueries(['productos-almacen']); toast.success('Producto eliminado del almacén'); },
        onError: (error) => toast.error(error.response?.data?.error?.message || 'Error al eliminar'),
    });

    const toggleActivoMutation = useMutation({
        mutationFn: async ({ id, activo }) => await productosService.toggleActivo(id, activo),
        onSuccess: (data) => { queryClient.invalidateQueries(['productos-almacen']); toast.success(data.activo ? 'Activado' : 'Desactivado'); },
    });

    // Filtros
    const filteredProductos = productos?.filter((prod) => {
        const matchesSearch = prod.nombre.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesTipo = filterTipo === 'todos' || prod.tipo === filterTipo;
        const matchesActivo = incluirInactivos || prod.activo;
        return matchesSearch && matchesTipo && matchesActivo;
    }) || [];

    // Resetear a página 1 si cambian los filtros
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, filterTipo, incluirInactivos]);

    // CÁLCULOS DE PAGINACIÓN
    const totalItems = filteredProductos.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const currentProductos = filteredProductos.slice(startIndex, startIndex + itemsPerPage);

    const handleNextPage = () => { if (currentPage < totalPages) setCurrentPage(prev => prev + 1); };
    const handlePrevPage = () => { if (currentPage > 1) setCurrentPage(prev => prev - 1); };

    const handleDelete = (producto) => {
        if (window.confirm(`¿Estás seguro de eliminar "${producto.nombre}" del almacén?`)) {
            deleteMutation.mutate(producto.id);
        }
    };

    // ESTADÍSTICAS ENFOCADAS EN INVENTARIO
    const stats = {
        total: productos?.length || 0,
        conStock: productos?.filter(p => p.stock_actual > 0).length || 0,
        stockBajo: productos?.filter(p => p.control_stock && p.stock_actual <= p.stock_minimo && p.stock_actual > 0).length || 0,
        sinStock: productos?.filter(p => p.control_stock && p.stock_actual <= 0).length || 0,
    };

    const getTipoBadgeColor = (tipo) => {
        return tipo === 'empacado' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-orange-100 text-orange-800 border-orange-200';
    };

    return (
        <div className="space-y-6 pb-10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
                        <Package className="h-8 w-8 text-blue-600" /> Almacén e Insumos
                    </h1>
                    <p className="text-gray-500 mt-1">Control de stock de mercadería, bebidas y materias primas</p>
                </div>
                <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-gray-900">
                        <input type="checkbox" checked={incluirInactivos} onChange={(e) => setIncluirInactivos(e.target.checked)} className="rounded text-blue-600 w-4 h-4 cursor-pointer" />
                        Mostrar inactivos
                    </label>
                    <Button onClick={() => navigate('/productos/almacen/crear')} className="bg-blue-600 hover:bg-blue-700">
                        <Plus className="h-5 w-5 mr-2" /> Nuevo Artículo
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Artículos Totales</p><p className="text-2xl font-bold text-gray-900">{stats.total}</p></CardContent></Card>
                <Card><CardContent className="pt-6"><p className="text-sm text-gray-500">Con Stock Seguro</p><p className="text-2xl font-bold text-green-600">{stats.conStock}</p></CardContent></Card>
                <Card className={stats.stockBajo > 0 ? "border-yellow-300 bg-yellow-50" : ""}><CardContent className="pt-6"><p className="text-sm text-gray-500">Stock Bajo (Alerta)</p><p className="text-2xl font-bold text-yellow-600">{stats.stockBajo}</p></CardContent></Card>
                <Card className={stats.sinStock > 0 ? "border-red-300 bg-red-50" : ""}><CardContent className="pt-6"><p className="text-sm text-gray-500">Agotados</p><p className="text-2xl font-bold text-red-600">{stats.sinStock}</p></CardContent></Card>
            </div>

            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <Input placeholder="Buscar por código o nombre..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="pl-10 border-blue-200 focus-visible:ring-blue-500" />
                </div>
                <select value={filterTipo} onChange={(e) => setFilterTipo(e.target.value)} className="px-4 py-2 border border-gray-300 rounded-md outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="todos">Todos los artículos</option>
                    <option value="empacado">Bebidas / Empacados</option>
                    <option value="insumo">Insumos / Ingredientes</option>
                </select>
            </div>

            <Card>
                <CardContent className="p-0 flex flex-col min-h-[400px]">
                    {isLoading ? (
                        <div className="flex flex-1 items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>
                    ) : filteredProductos?.length === 0 ? (
                        <div className="py-12 flex-1 text-center"><p className="text-gray-500">No se encontraron artículos en el almacén</p></div>
                    ) : (
                        <>
                            <div className="overflow-x-auto flex-1">
                                <table className="w-full">
                                    <thead className="bg-gray-50 border-b border-gray-200">
                                        <tr>
                                            <th className="text-left py-4 px-6 font-semibold text-gray-900">Artículo / Insumo</th>
                                            <th className="text-left py-4 px-6 font-semibold text-gray-900">Categoría</th>
                                            <th className="text-center py-4 px-6 font-semibold text-gray-900">Tipo</th>
                                            <th className="text-center py-4 px-6 font-semibold text-gray-900">Precio Venta</th>
                                            <th className="text-center py-4 px-6 font-semibold text-gray-900">Stock Actual</th>
                                            <th className="text-center py-4 px-6 font-semibold text-gray-900">Unidad</th>
                                            <th className="text-center py-4 px-6 font-semibold text-gray-900">Estado</th>
                                            <th className="text-center py-4 px-6 font-semibold text-gray-900">Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200">
                                        {currentProductos.map((producto) => {
                                            const isStockBajo = producto.control_stock && producto.stock_actual <= producto.stock_minimo;
                                            const isAgotado = producto.control_stock && producto.stock_actual <= 0;

                                            return (
                                                <tr key={producto.id} className={`hover:bg-gray-50 transition-colors ${!producto.activo ? 'opacity-60 bg-gray-50' : ''} ${isAgotado ? 'bg-red-50/50' : ''}`}>
                                                    <td className="py-4 px-6">
                                                        <div className="flex items-center gap-4">
                                                            {/* 👇 LÓGICA DE LA IMAGEN 👇 */}
                                                            {producto.imagen_url ? (
                                                                <img src={producto.imagen_url} alt={producto.nombre} className="w-10 h-10 rounded-lg object-cover border border-gray-200 bg-white flex-shrink-0" />
                                                            ) : (
                                                                <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200 flex-shrink-0">
                                                                    <Package className="h-5 w-5 text-gray-400" />
                                                                </div>
                                                            )}

                                                            {/* TEXTO Y ALERTAS */}
                                                            <div>
                                                                <p className="font-medium text-gray-900 flex items-center gap-2">
                                                                    {producto.nombre}
                                                                    {isStockBajo && !isAgotado && <AlertTriangle className="h-4 w-4 text-yellow-500" title="Stock Bajo" />}
                                                                    {isAgotado && <AlertTriangle className="h-4 w-4 text-red-500" title="Agotado" />}
                                                                </p>
                                                                {producto.descripcion && <p className="text-sm text-gray-500 truncate max-w-xs">{producto.descripcion}</p>}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="py-4 px-6 text-sm text-gray-700">{producto.categoria_nombre || '-'}</td>
                                                    <td className="py-4 px-6 text-center">
                                                        <Badge variant="outline" className={getTipoBadgeColor(producto.tipo)}>
                                                            {producto.tipo}
                                                        </Badge>
                                                    </td>
                                                    <td className="py-4 px-6 text-center font-medium">
                                                        {producto.tipo === 'insumo' ? (
                                                            <span className="text-gray-400">-</span>
                                                        ) : (
                                                            <span className="text-blue-600">S/ {toNumber(producto.precio_venta).toFixed(2)}</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        {producto.control_stock ? (
                                                            <span className={`font-bold text-lg ${isAgotado ? 'text-red-600' : isStockBajo ? 'text-yellow-600' : 'text-green-600'}`}>
                                                                {producto.stock_actual}
                                                            </span>
                                                        ) : (
                                                            <span className="text-gray-400">-</span>
                                                        )}
                                                    </td>
                                                    <td className="py-4 px-6 text-center text-sm text-gray-600 font-medium">
                                                        {producto.unidad_medida}
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <input type="checkbox" checked={producto.activo} onChange={() => toggleActivoMutation.mutate({ id: producto.id, activo: !producto.activo })} className="rounded cursor-pointer h-4 w-4 text-blue-600 focus:ring-blue-500" />
                                                    </td>
                                                    <td className="py-4 px-6 text-center">
                                                        <div className="flex justify-center gap-2">
                                                            <Button variant="ghost" size="sm" onClick={() => navigate(`/productos/editar/${producto.id}`)} className="hover:bg-blue-100 hover:text-blue-700">
                                                                <Edit className="h-4 w-4" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => handleDelete(producto)} className="text-red-500 hover:text-red-700 hover:bg-red-50">
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* FOOTER DE PAGINACIÓN */}
                            <div className="flex items-center justify-between border-t border-gray-200 bg-white px-6 py-4 rounded-b-lg">
                                <div className="text-sm text-gray-500">
                                    Mostrando <span className="font-medium">{totalItems === 0 ? 0 : startIndex + 1}</span> a <span className="font-medium">{Math.min(startIndex + itemsPerPage, totalItems)}</span> de <span className="font-medium">{totalItems}</span> artículos
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