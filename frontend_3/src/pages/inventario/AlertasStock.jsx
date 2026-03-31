import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Package, TrendingDown, ExternalLink, RefreshCw } from 'lucide-react';
// Asegúrate de tener este servicio configurado en tu frontend
import { alertasService } from '@/services/alertas.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const AlertasStock = () => {
  const navigate = useNavigate();
  const [filtro, setFiltro] = useState('todos');

  // Consulta única y optimizada: Solo pedimos los productos que ya sabemos que tienen stock bajo
// Consulta única y optimizada
  const { data: productosAlertaRaw, isLoading, refetch } = useQuery({
    queryKey: ['productos-stock-bajo'],
    queryFn: async () => {
      // Usamos tu servicio exacto
      return await alertasService.getStockBajo();
    },
    staleTime: 30000,
  });

  // Paracaídas por si el backend devuelve undefined
  const productosAlerta = productosAlertaRaw || [];

  // Filtramos los datos en memoria para los KPIs y las tablas
  const alertasFiltradas = productosAlerta?.filter(p => {
    if (filtro === 'todos') return true;
    if (filtro === 'stock_bajo') return p.stock_actual > 0 && p.stock_actual <= p.stock_minimo;
    if (filtro === 'stock_negativo') return p.stock_actual <= 0;
    return true;
  }) || [];

  const stats = {
    total: productosAlerta?.length || 0,
    bajo: productosAlerta?.filter(p => p.stock_actual > 0).length || 0,
    agotado: productosAlerta?.filter(p => p.stock_actual <= 0).length || 0,
  };

  const handleComprar = (productoId) => {
    // Redirigimos al módulo de compras. Es la única forma contablemente válida de reponer stock.
    navigate(`/inventario/compras/crear`);
  };

  const formatStock = (stock) => {
    if (stock === null || stock === undefined) return '-';
    // Removemos ceros innecesarios a la derecha si es decimal
    return parseFloat(stock).toString(); 
  };

  const getStockBadge = (actual) => {
    if (actual <= 0) return <Badge variant="destructive" className="bg-red-500 hover:bg-red-600">❌ Agotado</Badge>;
    return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">⚠️ Crítico</Badge>;
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Monitor de Stock</h1>
          <p className="text-gray-500 mt-1">Control de insumos críticos que requieren reabastecimiento</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => refetch()} className="bg-white">
             <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> 
             Actualizar
          </Button>
          <select
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-md bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="todos">Todos los Críticos</option>
            <option value="stock_bajo">Solo Stock Bajo</option>
            <option value="stock_negativo">Solo Agotados</option>
          </select>
        </div>
      </div>

      {/* Tarjetas de resumen (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-gray-100 rounded-full">
                <AlertTriangle className="h-6 w-6 text-gray-700" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">Total Alertas</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-200 shadow-sm bg-orange-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-orange-100 rounded-full">
                <TrendingDown className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-orange-800 uppercase tracking-wider">Por Agotarse</p>
                <p className="text-3xl font-bold text-orange-700">{stats.bajo}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-red-200 shadow-sm bg-red-50/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-4 bg-red-100 rounded-full">
                <Package className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-red-800 uppercase tracking-wider">Agotados (Stock 0)</p>
                <p className="text-3xl font-bold text-red-700">{stats.agotado}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista detallada de Alertas */}
      <Card className="shadow-md border-red-100">
        <CardHeader className="bg-red-50/50 border-b border-red-100">
          <CardTitle className="flex items-center gap-2 text-red-800">
            <AlertTriangle className="h-5 w-5" />
            Atención Requerida
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            </div>
          ) : alertasFiltradas.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="h-8 w-8 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">¡Inventario Sano!</h3>
              <p className="text-gray-500">Ningún producto está por debajo de su límite de seguridad.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Producto / Insumo</th>
                    <th className="text-left py-4 px-6 font-semibold text-gray-600 text-sm">Categoría</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600 text-sm">Stock Mínimo</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600 text-sm">Stock Actual</th>
                    <th className="text-center py-4 px-6 font-semibold text-gray-600 text-sm">Estado</th>
                    <th className="text-right py-4 px-6 font-semibold text-gray-600 text-sm">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {alertasFiltradas.map((producto) => (
                    <tr key={producto.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="py-4 px-6">
                        <p className="font-bold text-gray-900">{producto.nombre}</p>
                      </td>
                      <td className="py-4 px-6">
                        <span className="text-sm text-gray-500 capitalize">{producto.categoria_nombre || 'General'}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className="text-gray-500 font-mono">{formatStock(producto.stock_minimo)} {producto.unidad_medida}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        <span className={`font-mono text-lg font-bold ${producto.stock_actual <= 0 ? 'text-red-600' : 'text-orange-500'}`}>
                          {formatStock(producto.stock_actual)}
                        </span>
                        <span className="text-xs text-gray-400 ml-1">{producto.unidad_medida}</span>
                      </td>
                      <td className="py-4 px-6 text-center">
                        {getStockBadge(producto.stock_actual)}
                      </td>
                      <td className="py-4 px-6 text-right">
                        <Button
                          size="sm"
                          className="bg-gray-900 hover:bg-gray-800 text-white shadow-sm"
                          onClick={() => handleComprar(producto.id)}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" /> Abastecer
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};