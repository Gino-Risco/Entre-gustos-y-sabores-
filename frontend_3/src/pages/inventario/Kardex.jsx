import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, ArrowDownRight, ArrowUpRight, Search, RefreshCw, Filter } from 'lucide-react';
import { kardexService } from '@/services/kardex.service';
import { productosService } from '@/services/productos.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const Kardex = () => {
  const [productoId, setProductoId] = useState('');
  
  // 1. Traer lista de productos para el filtro
  const { data: productosData } = useQuery({
    queryKey: ['productos-lista'],
    queryFn: () => productosService.getAll(),
  });
  const productos = productosData?.productos || productosData || [];

  // 2. Traer los movimientos del Kardex
  const { data: kardexData, isLoading, refetch } = useQuery({
    queryKey: ['kardex', productoId],
    queryFn: () => productoId ? kardexService.getPorProducto(productoId) : kardexService.getAll(),
  });
  
  const movimientos = kardexData || [];

  const formatFecha = (fecha) => {
    return new Date(fecha).toLocaleString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getMovimientoEstilo = (tipo) => {
    const tiposEntrada = ['compra', 'ajuste_ingreso', 'entrada'];
    if (tiposEntrada.includes(tipo?.toLowerCase())) {
      return { 
        color: 'text-green-600', 
        bg: 'bg-green-50', 
        signo: '+', 
        icono: <ArrowDownRight className="h-4 w-4 text-green-600 mr-1" /> 
      };
    }
    return { 
      color: 'text-red-600', 
      bg: 'bg-red-50', 
      signo: '-', 
      icono: <ArrowUpRight className="h-4 w-4 text-red-600 mr-1" /> 
    };
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kardex Físico</h1>
          <p className="text-gray-500 mt-1">Historial inmutable de movimientos de inventario</p>
        </div>
        <Button variant="outline" onClick={() => refetch()} className="bg-white">
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> 
          Actualizar Historial
        </Button>
      </div>

      {/* FILTROS */}
      <Card className="shadow-sm">
        <CardContent className="p-4 flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 w-full">
            <label className="text-sm font-medium text-gray-700 mb-1 flex items-center">
              <Filter className="h-4 w-4 mr-1" /> Filtrar por Producto
            </label>
            <select
              value={productoId}
              onChange={(e) => setProductoId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los productos</option>
              {productos.map(p => (
                <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida})</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* TABLA DEL KARDEX */}
      <Card className="shadow-md">
        <CardHeader className="bg-gray-50 border-b">
          <CardTitle className="flex items-center gap-2 text-gray-800 text-lg">
            <FileText className="h-5 w-5" />
            Registro de Movimientos
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : movimientos.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Sin movimientos</h3>
              <p className="text-gray-500">No hay registros para los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 text-gray-600 border-b">
                  <tr>
                    <th className="text-left py-3 px-4 font-semibold">Fecha</th>
                    <th className="text-left py-3 px-4 font-semibold">Producto</th>
                    <th className="text-center py-3 px-4 font-semibold">Operación</th>
                    <th className="text-right py-3 px-4 font-semibold">Stock Anterior</th>
                    <th className="text-right py-3 px-4 font-semibold">Cantidad</th>
                    <th className="text-right py-3 px-4 font-semibold">Saldo Final</th>
                    <th className="text-left py-3 px-4 font-semibold">Referencia</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {movimientos.map((mov) => {
                    const estilo = getMovimientoEstilo(mov.tipo_movimiento);
                    return (
                      <tr key={mov.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-gray-500 whitespace-nowrap">
                          {formatFecha(mov.created_at)}
                        </td>
                        <td className="py-3 px-4 font-medium text-gray-900">
                          {mov.producto_nombre}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <Badge variant="outline" className={`uppercase text-xs font-bold ${estilo.color} ${estilo.bg} border-transparent`}>
                            {mov.tipo_movimiento.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right text-gray-500 font-mono">
                          {Number(mov.stock_anterior)}
                        </td>
                        <td className={`py-3 px-4 text-right font-mono font-bold flex items-center justify-end ${estilo.color}`}>
                          {estilo.icono}
                          {estilo.signo}{Number(mov.cantidad)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                          {Number(mov.stock_nuevo)}
                        </td>
                        <td className="py-3 px-4 text-gray-600 text-xs">
                          {mov.referencia || '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};