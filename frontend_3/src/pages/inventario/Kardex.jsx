import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { FileText, Search, RefreshCw, Filter, Download, ChevronLeft, ChevronRight, User, X} from 'lucide-react';
import { kardexService } from '@/services/kardex.service';
import { productosService } from '@/services/productos.service';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export const Kardex = () => {
  // Estados para los Filtros
  const [productoId, setProductoId] = useState('');
  const [tipoMovimiento, setTipoMovimiento] = useState('');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  // Estados para Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Carga de productos para el filtro
  const { data: productosData } = useQuery({
    queryKey: ['productos-lista'],
    queryFn: () => productosService.getAll(),
  });
  const productos = productosData?.productos || productosData || [];

  // Carga de movimientos del Kardex
  const { data: kardexData, isLoading, refetch } = useQuery({
    queryKey: ['kardex', { productoId, tipoMovimiento, fechaDesde, fechaHasta }],
    queryFn: () => kardexService.getAll({
      producto_id: productoId,
      tipo_movimiento: tipoMovimiento,
      fecha_desde: fechaDesde,
      fecha_hasta: fechaHasta
    }),
  });

  const movimientos = kardexData || [];

  // Paginación
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = movimientos.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(movimientos.length / itemsPerPage);

  // Formateadores
  const formatFecha = (fecha) => {
    // CORRECCIÓN: Solo muestra la fecha, sin la hora
    return new Date(fecha).toLocaleDateString('es-PE', {
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
  };

  const formatMoney = (monto) => {
    // CORRECCIÓN: Forzamos a que siempre tenga 2 decimales exactos
    return new Intl.NumberFormat('es-PE', {
      style: 'currency',
      currency: 'PEN',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(monto || 0);
  };

  const getTipoEstilo = (tipo) => {
    const entradas = ['compra', 'ajuste_entrada', 'reversion'];
    const esEntrada = entradas.includes(tipo?.toLowerCase());
    return {
      color: esEntrada ? 'text-emerald-600' : 'text-rose-600',
      bg: esEntrada ? 'bg-emerald-50' : 'bg-rose-50',
      border: esEntrada ? 'border-emerald-200' : 'border-rose-200',
      signo: esEntrada ? '+' : '-'
    };
  };

  const limpiarFiltros = () => {
    setProductoId('');
    setTipoMovimiento('');
    setFechaDesde('');
    setFechaHasta('');
    setCurrentPage(1);
  };

  const exportarExcel = () => {
    const headers = ['Fecha', 'Producto', 'Operacion', 'Cantidad', 'Stock', 'Costo Unit', 'Total', 'Referencia', 'Usuario'];

    // Función de seguridad: Envuelve los textos en comillas ("") 
    // para que si un usuario escribe una coma, no rompa las columnas en Excel
    const formatearCelda = (texto) => `"${String(texto || '').replace(/"/g, '""')}"`;

    const rows = movimientos.map(m => [
      formatFecha(m.created_at),
      formatearCelda(m.producto_nombre),
      m.tipo_movimiento.toUpperCase(),
      m.cantidad,
      m.stock_nuevo,
      Number(m.costo_unitario).toFixed(2),
      Math.abs(Number(m.valor_movimiento)).toFixed(2),
      formatearCelda(m.referencia),
      formatearCelda(m.usuario_nombre)
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');

    // Usar Blob con BOM (\ufeff) para compatibilidad perfecta con Excel
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_Kardex_${new Date().toLocaleDateString('es-PE').replace(/\//g, '-')}.csv`);

    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url); // Liberar memoria del navegador
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Kardex de Inventario</h1>
          <p className="text-slate-500 text-sm">Consulta de movimientos y valorización de stock</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportarExcel} className="border-emerald-200 text-emerald-600 hover:bg-emerald-50">
            <Download className="h-4 w-4 mr-2" /> Exportar Excel
          </Button>
          <Button onClick={() => refetch()} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} /> Actualizar
          </Button>
        </div>
      </div>

      {/* ÁREA DE FILTROS ACTUALIZADA */}
      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            {/* Producto */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-wider">Producto</label>
              <select
                value={productoId}
                onChange={(e) => { setProductoId(e.target.value); setCurrentPage(1); }}
                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
              >
                <option value="">Todos los productos</option>
                {productos.map(p => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </select>
            </div>

            {/* Tipo de Operación */}
            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-wider">Operación</label>
              <select
                value={tipoMovimiento}
                onChange={(e) => { setTipoMovimiento(e.target.value); setCurrentPage(1); }}
                className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
              >
                <option value="">Todas las operaciones</option>
                <option value="compra">Compra</option>
                <option value="venta">Venta</option>
                <option value="salida_cocina">Salida Cocina</option>
                <option value="ajuste_entrada">Ajuste Entrada</option>
                <option value="ajuste_salida">Ajuste Salida</option>
                <option value="merma">Merma</option>
                <option value="reversion">Reversión</option>
              </select>
            </div>

            {/* Rango de Fechas */}
            <div className="md:col-span-2 flex gap-4">
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-wider">Desde</label>
                <input
                  type="date"
                  value={fechaDesde}
                  onChange={(e) => { setFechaDesde(e.target.value); setCurrentPage(1); }}
                  className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                />
              </div>
              <div className="flex-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase mb-1.5 block tracking-wider">Hasta</label>
                <input
                  type="date"
                  value={fechaHasta}
                  onChange={(e) => { setFechaHasta(e.target.value); setCurrentPage(1); }}
                  className="w-full h-10 px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none transition-all shadow-sm"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={limpiarFiltros}
                className="h-10 w-10 text-slate-400 hover:text-rose-500 hover:bg-rose-50"
                title="Limpiar filtros"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* TABLA SIMPLIFICADA */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-100/30 border-b border-slate-100 py-3">
          <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <FileText className="h-4 w-4 text-slate-400" /> Movimientos Registrados
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-200 text-slate-700 border-b border-slate-300">
                <tr>
                  <th className="py-3 px-8 font-semibold text-left">Fecha</th>
                  <th className="py-3 px-4 font-semibold text-left">Producto</th>
                  <th className="py-3 px-4 font-semibold text-center">Operación</th>
                  <th className="py-3 px-4 font-semibold text-right w-25">Cantidad</th>
                  <th className="py-3 px-1 font-semibold text-right w-24">Stock</th>
                  <th className="py-3 px-4 font-semibold text-right w-22">Costo Unit.</th>
                  <th className="py-3 px-4 font-semibold text-right w-28">Total</th>
                  <th className="py-3 px-4 font-semibold text-left pl-20">Referencia</th>
                  <th className="py-3 px-4 font-semibold text-left">Usuario</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {isLoading ? (
                  <tr><td colSpan="9" className="py-10 text-center text-slate-400">Cargando movimientos...</td></tr>
                ) : currentItems.length === 0 ? (
                  <tr><td colSpan="9" className="py-10 text-center text-slate-400">No se encontraron registros</td></tr>
                ) : (
                  currentItems.map((m) => {
                    const estilo = getTipoEstilo(m.tipo_movimiento);
                    return (
                      <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                        {/* Fecha: Alineación Izquierda */}
                        <td className="py-3 px-4 text-slate-500 whitespace-nowrap">{formatFecha(m.created_at)}</td>

                        {/* Producto: Alineación Izquierda */}
                        <td className="py-3 px-4 font-medium text-slate-700">{m.producto_nombre}</td>

                        {/* Operación: Alineación Centro */}
                        <td className="py-3 px-2 text-center">
                          <Badge variant="outline" className={`text-[12px] uppercase font-bold px-2 py-0.5 ${estilo.bg} ${estilo.color} ${estilo.border} border`}>
                            {m.tipo_movimiento.replace('_', ' ')}
                          </Badge>
                        </td>

                        {/* Cantidad: Alineación Derecha */}
                        <td className={`py-3 px-8 text-right font-bold ${estilo.color}`}>
                          {estilo.signo}{Number(m.cantidad)}
                        </td>

                        {/* Stock: Alineación Derecha */}
                        <td className="py-3 px-4 text-right font-semibold text-slate-600 bg-slate-50/30">{Number(m.stock_nuevo)}</td>

                        {/* Costo Unit: Alineación Derecha con fuente monoespaciada para alinear números */}
                        <td className="py-3 px-8 text-right text-slate-500 font-mono text-sm">{formatMoney(m.costo_unitario)}</td>

                        {/* Total: Alineación Derecha */}
                        <td className="py-3 px-3 text-right font-bold text-slate-700 font-mono text-sm">{formatMoney(Math.abs(m.valor_movimiento))}</td>

                        {/* Referencia: Alineación Izquierda */}
                        <td className="py-4 px-12 pl-18 text-slate-400 text-xs max-w-[150px] truncate" title={m.referencia}>{m.referencia || '-'}</td>

                        {/* Usuario: Alineación Izquierda */}
                        <td className="py-3 px-1 text-slate-500 text-xs">
                          <div className="flex items-center gap-1.5">
                            <User className="h-3 w-3 text-slate-300" />
                            {m.usuario_nombre || 'Sist.'}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>

        {/* PAGINACIÓN SIMPLE */}
        {totalPages > 1 && (
          <div className="p-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
            <p className="text-xs text-slate-500 font-medium">Página {currentPage} de {totalPages}</p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => prev - 1)}
                className="h-8 px-2 border-slate-200"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => prev + 1)}
                className="h-8 px-2 border-slate-200"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};