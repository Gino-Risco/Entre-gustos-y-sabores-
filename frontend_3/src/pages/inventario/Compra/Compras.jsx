import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, FileText, Eye, Trash2, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { comprasService } from '@/services/compras.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const Compras = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filtros, setFiltros] = useState({
    fecha_desde: '',
    fecha_hasta: '',
    proveedor_id: '',
  });
  const [showAnularModal, setShowAnularModal] = useState(false);
  const [compraSeleccionada, setCompraSeleccionada] = useState(null);
  const [motivoAnulacion, setMotivoAnulacion] = useState('');

  const { data: compras, isLoading } = useQuery({
    queryKey: ['compras', filtros],
    queryFn: async () => await comprasService.getAllCompras(filtros),
    staleTime: 30000,
  });

  const { data: proveedores } = useQuery({
    queryKey: ['proveedores'],
    queryFn: async () => await comprasService.getAllProveedores(),
    staleTime: 60000,
  });

  const handleAnular = async () => {
    if (!compraSeleccionada || !motivoAnulacion.trim()) {
      Swal.fire({ icon: 'warning', title: 'Campo requerido', text: 'Ingresa el motivo de anulación' });
      return;
    }
    try {
      await comprasService.anularCompra(compraSeleccionada.id, motivoAnulacion);
      queryClient.invalidateQueries(['compras']);
      setShowAnularModal(false);
      setCompraSeleccionada(null);
      setMotivoAnulacion('');
      Swal.fire({ icon: 'success', title: 'Compra anulada', text: 'Stock revertido automáticamente', timer: 2000, showConfirmButton: false });
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al anular compra' });
    }
  };

  const formatMonto = (monto) => `S/ ${parseFloat(monto || 0).toFixed(2)}`;
  
  // Usamos zonas horarias seguras para la fecha
  const formatDate = (date) => new Date(date).toLocaleDateString('es-PE', { timeZone: 'UTC' });

  // NUEVO: Formateador del comprobante contable
  const formatComprobante = (compra) => {
    const tipo = compra.tipo_comprobante || 'Nota de Venta';
    const serie = compra.serie_comprobante ? `${compra.serie_comprobante}-` : '';
    const numero = compra.numero_comprobante || 'S/N'; // Sin Número
    
    if (tipo === 'Nota de Venta' && !compra.serie_comprobante && !compra.numero_comprobante) {
      return tipo;
    }
    return `${tipo} ${serie}${numero}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Compras</h1>
          <p className="text-gray-500 mt-1">Registro de entradas de insumos</p>
        </div>
        <Button onClick={() => navigate('/inventario/compras/crear')} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-5 w-5 mr-2" /> Nueva Compra
        </Button>
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Search className="h-5 w-5" /> Filtros de Búsqueda</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Fecha Desde</label>
              <Input type="date" value={filtros.fecha_desde} onChange={(e) => setFiltros(prev => ({ ...prev, fecha_desde: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha Hasta</label>
              <Input type="date" value={filtros.fecha_hasta} onChange={(e) => setFiltros(prev => ({ ...prev, fecha_hasta: e.target.value }))} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Proveedor</label>
              <select value={filtros.proveedor_id} onChange={(e) => setFiltros(prev => ({ ...prev, proveedor_id: e.target.value }))} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md">
                <option value="">Todos</option>
                {proveedores?.map(p => (<option key={p.id} value={p.id}>{p.nombre}</option>))}
              </select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => setFiltros({ fecha_desde: '', fecha_hasta: '', proveedor_id: '' })}>Limpiar</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Historial de Compras</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
          ) : compras?.length === 0 ? (
            <div className="text-center py-12"><FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" /><p className="text-gray-500">No hay compras registradas</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b text-sm text-gray-600">
                    <th className="text-left py-3 px-4">N° Compra</th>
                    <th className="text-left py-3 px-4">Comprobante</th>
                    <th className="text-left py-3 px-4">Proveedor</th>
                    <th className="text-left py-3 px-4">Fecha</th>
                    <th className="text-right py-3 px-4">Total</th>
                    <th className="text-center py-3 px-4">Estado</th>
                    <th className="text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {compras?.map((compra) => (
                    <tr key={compra.id} className={`border-b hover:bg-gray-50 transition-colors ${!compra.activo ? 'opacity-60 bg-gray-50' : ''}`}>
                      <td className="py-3 px-4 font-mono text-xs text-gray-500">{compra.numero_compra}</td>
                      <td className="py-3 px-4 font-medium text-sm">{formatComprobante(compra)}</td>
                      <td className="py-3 px-4 text-sm">{compra.proveedor_nombre}</td>
                      <td className="py-3 px-4 text-sm text-gray-600">{formatDate(compra.fecha_emision || compra.created_at)}</td>
                      <td className="py-3 px-4 text-right font-semibold text-gray-900">{formatMonto(compra.total)}</td>
                      <td className="py-3 px-4 text-center">
                        <Badge className={compra.activo ? 'bg-blue-100 text-blue-800 hover:bg-blue-200' : 'bg-red-100 text-red-800 hover:bg-red-200'} variant="outline">
                          {compra.activo ? 'Activa' : 'Anulada'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => navigate(`/inventario/compras/${compra.id}`)}><Eye className="h-4 w-4 text-gray-600" /></Button>
                          {compra.activo && (
                            <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => { setCompraSeleccionada(compra); setShowAnularModal(true); }}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal Anular */}
      {showAnularModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-red-600 mb-4 flex items-center gap-2"><AlertCircle className="h-5 w-5" /> Anular Compra</h3>
            <p className="text-sm text-gray-600 mb-4">¿Estás seguro de anular la compra <strong>{compraSeleccionada?.numero_compra}</strong>?<br/><span className="text-red-600 font-medium">Esto revertirá el stock ingresado al almacén.</span></p>
            <div className="mb-5">
              <label className="block text-sm font-medium mb-1 text-gray-700">Motivo de la anulación *</label>
              <Input autoFocus value={motivoAnulacion} onChange={(e) => setMotivoAnulacion(e.target.value)} placeholder="Ej: Error en los montos registrados" />
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setShowAnularModal(false); setCompraSeleccionada(null); setMotivoAnulacion(''); }}>Cancelar</Button>
              <Button onClick={handleAnular} className="bg-red-600 hover:bg-red-700 text-white" disabled={!motivoAnulacion.trim()}>Sí, Anular Compra</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};