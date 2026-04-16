import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  History,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  FileText,
  Receipt,
  Printer
} from 'lucide-react';
import Swal from 'sweetalert2';
import { ordenesService } from '@/services/ordenes.service';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

const ESTADO_CONFIG = {
  abierta: { label: 'Abierta', badgeClass: 'bg-blue-100 text-blue-700 border-blue-200' },
  enviada_cocina: { label: 'En Cocina', badgeClass: 'bg-orange-100 text-orange-700 border-orange-200' },
  cobrada: { label: 'Pagada', badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  cancelada: { label: 'Cancelada', badgeClass: 'bg-red-100 text-red-600 border-red-200' },
};

export const HistorialPedidos = () => {
  const navigate = useNavigate();
  
  // --- ESTADOS DE FILTRO Y PAGINACIÓN ---
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // --- OBTENCIÓN DE DATOS ---
  const { data: historial = [], isLoading } = useQuery({
    queryKey: ['historial-pedidos', filtroEstado, fechaInicio, fechaFin],
    queryFn: async () => {
      const params = {
        estado: filtroEstado === 'todos' ? undefined : filtroEstado,
        fecha_desde: fechaInicio || undefined,
        fecha_hasta: fechaFin || undefined
      };
      const data = await ordenesService.getAll(params);
      return (data || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    },
    staleTime: 30000,
  });

  // --- LÓGICA DE FILTRADO ---
  const ordenesFiltradas = historial.filter((o) => {
    const q = busqueda.toLowerCase();
    return (
      o.numero_comanda?.toLowerCase().includes(q) ||
      o.nombre_cliente?.toLowerCase().includes(q) ||
      String(o.mesa_numero)?.includes(q) ||
      o.mesero_nombre?.toLowerCase().includes(q)
    );
  });

  // Reiniciar a la página 1 si cambia algún filtro
  useEffect(() => {
    setCurrentPage(1);
  }, [busqueda, filtroEstado, fechaInicio, fechaFin]);

  // --- LÓGICA DE PAGINACIÓN ---
  const totalPages = Math.ceil(ordenesFiltradas.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = ordenesFiltradas.slice(indexOfFirstItem, indexOfLastItem);

  // --- ESTADÍSTICAS ---
  const stats = {
    pagadas: historial.filter(o => o.estado === 'cobrada').length,
    activas: historial.filter(o => ['abierta', 'enviada_cocina', 'preparando', 'lista'].includes(o.estado)).length,
    totalVentas: historial
      .filter(o => o.estado === 'cobrada')
      .reduce((s, o) => s + parseFloat(o.total_real || o.total || 0), 0)
  };

  // --- ACCIÓN: VER DETALLE (MODAL) ---
  const handleVerDetalle = async (ordenId) => {
    try {
      Swal.fire({
        title: 'Cargando detalle...',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading(); }
      });

      const orden = await ordenesService.getById(ordenId);
      const esLlevar = !orden.mesa_id;

      const detallesHtml = orden.detalles?.map(d => {
        const esCortesia = parseFloat(d.precio) === 0;
        const precioTexto = esCortesia 
          ? '<span style="color: #f97316; font-weight: bold; font-size: 11px;">CORTESÍA</span>' 
          : `S/ ${parseFloat(d.subtotal || (d.precio * d.cantidad) || 0).toFixed(2)}`;
        
        return `
          <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 8px; border-bottom: 1px dashed #e2e8f0; padding-bottom: 4px;">
            <span style="color: #475569;">${d.cantidad}x ${d.producto_nombre || d.nombre || 'Plato sin nombre'}</span>
            <span style="font-weight: bold; color: #0f172a;">${precioTexto}</span>
          </div>
        `;
      }).join('') || '<p style="text-align:center; color:#94a3b8; font-size:12px;">Sin productos registrados</p>';

      let infoExtraHtml = '';
      if (orden.observaciones) infoExtraHtml += `<p style="color:#64748b; font-size:12px; margin-top:8px;"><strong>Notas:</strong> ${orden.observaciones}</p>`;
      if (orden.motivo_cancelacion) infoExtraHtml += `<p style="color:#ef4444; font-size:12px; margin-top:8px;"><strong>Motivo Cancelación:</strong> ${orden.motivo_cancelacion}</p>`;

      Swal.fire({
        title: `Pedido #${orden.numero_comanda?.split('-')[2] || orden.id}`,
        html: `
          <div style="text-align: left; font-family: sans-serif;">
            <div style="background: #f8fafc; padding: 12px; border-radius: 6px; margin-bottom: 15px; font-size: 13px; color: #334155; border: 1px solid #e2e8f0;">
              <p><strong>${esLlevar ? '🛍️ Cliente:' : '🍽️ Mesa:'}</strong> ${esLlevar ? (orden.nombre_cliente || 'Para Llevar') : orden.mesa_numero}</p>
              <p><strong>👨‍🍳 Mesero:</strong> ${orden.mesero_nombre}</p>
              <p><strong>📅 Fecha:</strong> ${new Date(orden.created_at).toLocaleString('es-PE')}</p>
              <p style="margin-top:4px;"><strong>Estado:</strong> <span style="text-transform: uppercase; font-weight: bold;">${orden.estado}</span></p>
            </div>
            
            <div style="max-height: 250px; overflow-y: auto; padding-right: 5px;">
              ${detallesHtml}
            </div>
            
            ${infoExtraHtml}

            <div style="border-top: 2px dashed #cbd5e1; margin-top: 15px; padding-top: 12px;">
              <div style="display: flex; justify-content: space-between; font-size: 1.25rem; font-weight: 900; color: #2563eb;">
                <span>TOTAL:</span> <span>S/ ${parseFloat(orden.total_real || orden.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        `,
        confirmButtonText: 'Cerrar Detalle',
        confirmButtonColor: '#3b82f6',
        width: '450px'
      });
    } catch (error) {
      Swal.fire('Error', 'No se pudo cargar el detalle del pedido', 'error');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => navigate('/pedidos')} className="text-gray-500 hover:bg-gray-100">
          <ArrowLeft className="h-4 w-4 mr-1" /> Volver a Pedidos
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
          <History className="h-8 w-8 text-blue-600" />
          Historial de Pedidos
        </h1>
        <p className="text-gray-500 mt-1">Auditoría detallada de órdenes en salón y para llevar</p>
      </div>

      {/* ── TARJETAS DE ESTADÍSTICAS ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-emerald-700">{stats.pagadas}</p>
            <p className="text-xs text-emerald-600 font-bold uppercase tracking-wider">Órdenes Pagadas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-blue-700">{stats.activas}</p>
            <p className="text-xs text-blue-600 font-bold uppercase tracking-wider">Órdenes Activas</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-slate-700 bg-slate-50">
          <CardContent className="pt-4 text-center">
            <p className="text-3xl font-bold text-slate-800">S/ {stats.totalVentas.toFixed(2)}</p>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-wider">Ventas Totales</p>
          </CardContent>
        </Card>
      </div>

      {/* ── BARRA DE FILTROS ── */}
      <Card className="bg-white shadow-sm border-gray-200">
        <CardContent className="p-4 space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar comanda, cliente o mesa..."
                className="pl-9"
                value={busqueda}
                onChange={e => setBusqueda(e.target.value)}
              />
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
              {['todos', 'abierta', 'cobrada', 'cancelada'].map(tab => (
                <button
                  key={tab}
                  onClick={() => setFiltroEstado(tab)}
                  className={`flex-1 px-2 py-1.5 rounded-md text-[11px] font-bold uppercase transition-all ${
                    filtroEstado === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab === 'cobrada' ? 'Pagados' : tab === 'todos' ? 'Todos' : tab + 's'}
                </button>
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={() => { setFechaInicio(''); setFechaFin(''); setBusqueda(''); setFiltroEstado('todos'); }} className="text-gray-400">
              Limpiar filtros
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-4 border-t pt-4 border-gray-100">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span className="text-xs font-bold text-gray-500 uppercase">Desde:</span>
              <Input type="date" className="h-9 text-sm" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <span className="text-xs font-bold text-gray-500 uppercase">Hasta:</span>
              <Input type="date" className="h-9 text-sm" value={fechaFin} onChange={e => setFechaFin(e.target.value)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── TABLA DE DATOS ── */}
      <Card className="shadow-sm border-gray-200">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" /></div>
          ) : (
            <div className="flex flex-col">
              <div className="overflow-x-auto rounded-t-lg">
                <table className="w-full text-sm text-left text-gray-600">
                  <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-4">Fecha y Hora</th>
                      <th className="px-6 py-4">Comanda</th>
                      <th className="px-6 py-4">Mesa / Cliente</th>
                      <th className="px-6 py-4">Mesero</th>
                      <th className="px-6 py-4 text-center">Estado</th>
                      <th className="px-6 py-4 text-right">Total</th>
                      <th className="px-6 py-4 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {currentItems.length > 0 ? (
                      currentItems.map((orden) => {
                        const cfg = ESTADO_CONFIG[orden.estado] || ESTADO_CONFIG.abierta;
                        return (
                          <tr key={orden.id} className={`bg-white border-b hover:bg-gray-50 ${orden.estado === 'cancelada' ? 'opacity-70 bg-red-50' : ''}`}>
                            <td className="px-6 py-4 font-medium text-gray-900 whitespace-nowrap">
                              {new Date(orden.created_at).toLocaleString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute:'2-digit' })}
                            </td>
                            <td className="px-6 py-4 font-mono font-medium text-gray-500">#{orden.numero_comanda?.split('-')[2] || orden.id}</td>
                            <td className="px-6 py-4 font-bold text-gray-800">
                              {orden.mesa_id ? `Mesa ${orden.mesa_numero}` : `🛍️ ${orden.nombre_cliente || 'Para Llevar'}`}
                            </td>
                            <td className="px-6 py-4">{orden.mesero_nombre}</td>
                            <td className="px-6 py-4 text-center">
                              <Badge variant="outline" className={`${cfg.badgeClass} text-[10px] uppercase font-bold tracking-wider`}>
                                {cfg.label}
                              </Badge>
                            </td>
                            <td className={`px-6 py-4 text-right font-black ${orden.estado === 'cancelada' ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                              S/ {parseFloat(orden.total_real || orden.total || 0).toFixed(2)}
                            </td>
                            <td className="px-6 py-4 flex justify-center gap-2">
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="h-8 w-8 p-0 border-blue-200 hover:bg-blue-50" 
                                title="Ver Detalle del Pedido"
                                onClick={() => handleVerDetalle(orden.id)}
                              >
                                <FileText className="h-4 w-4 text-blue-600" />
                              </Button>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                          <Receipt className="h-10 w-10 mx-auto text-gray-300 mb-3" />
                          No se encontraron órdenes con los filtros actuales.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* ── PAGINACIÓN ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50 rounded-b-lg">
                  <span className="text-sm text-gray-700">
                    Mostrando del <span className="font-semibold">{indexOfFirstItem + 1}</span> al{' '}
                    <span className="font-semibold">{Math.min(indexOfLastItem, ordenesFiltradas.length)}</span> de{' '}
                    <span className="font-semibold">{ordenesFiltradas.length}</span> registros
                  </span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} disabled={currentPage === 1} className="h-8 flex items-center gap-1">
                      <ChevronLeft className="h-4 w-4" /> Anterior
                    </Button>
                    <div className="text-sm font-medium px-4 py-1.5 bg-white border border-gray-200 rounded-md">
                      Página {currentPage} de {totalPages}
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} disabled={currentPage === totalPages} className="h-8 flex items-center gap-1">
                      Siguiente <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};