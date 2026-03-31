import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, DollarSign, ArrowLeft, Search, AlertCircle } from 'lucide-react';
import Swal from 'sweetalert2';
import { ventasService } from '@/services/ventas.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const Ventas = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const [searchMesa, setSearchMesa] = useState('');
  const [ordenSeleccionada, setOrdenSeleccionada] = useState(null);
  const [pagoForm, setPagoForm] = useState({
    metodo_pago: 'efectivo',
    monto_pagado: '',
  });

  // Fetch órdenes disponibles para cobrar
  // ✅ CORRECCIÓN: Mostrar TODAS las órdenes activas (no solo 'enviada_cocina')
  const { data: ordenes, isLoading: ordenesLoading } = useQuery({
    queryKey: ['ordenes-por-cobrar'],
    queryFn: async () => {
      const data = await ventasService.getOrdenesPorCobrar();
      // ✅ Mostrar órdenes en estados: 'abierta', 'enviada_cocina', 'preparando', 'lista'
      return data.filter(o =>
        ['abierta', 'enviada_cocina', 'preparando', 'lista'].includes(o.estado)
      );
    },
    staleTime: 10000,
    refetchInterval: 3000,
  });

  // Fetch orden seleccionada con detalles
  const { data: ordenDetalle, isLoading: detalleLoading } = useQuery({
    queryKey: ['orden-detalle', ordenSeleccionada?.id],
    queryFn: async () => {
      if (!ordenSeleccionada?.id) return null;
      return await ventasService.getOrdenParaCobrar(ordenSeleccionada.id);
    },
    enabled: !!ordenSeleccionada?.id,
    staleTime: 0,
  });

  // Mutation para cobrar
  const cobrarMutation = useMutation({
    mutationFn: async (data) => {
      // Verificar caja abierta primero
      const cajaEstado = await ventasService.verificarCajaAbierta();
      if (!cajaEstado.caja_abierta) {
        throw new Error('La caja debe estar abierta para cobrar');
      }
      return await ventasService.crear(data);
    },
    onSuccess: (venta) => {
      queryClient.invalidateQueries(['ordenes-por-cobrar']);
      imprimirComprobante(venta);
      Swal.fire({
        icon: 'success',
        title: '¡Cobro exitoso!',
        text: `Vuelto: S/ ${parseFloat(venta.vuelto || 0).toFixed(2)}`,
        timer: 2000,
        showConfirmButton: false,
      });
      setOrdenSeleccionada(null);
      setPagoForm({ metodo_pago: 'efectivo', monto_pagado: '' });
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error al cobrar',
        text: error.message || 'Verifica que la caja esté abierta',
      });
    },
  });

  // Filtrar órdenes por mesa
  const ordenesFiltradas = ordenes?.filter((orden) => {
    if (!searchMesa) return true;
    return orden.mesa_numero.toString().includes(searchMesa);
  });

  // Calcular total de la orden (solo items no incluidos en menú)
  const calcularTotal = (detalles) => {
    if (!detalles) return 0;
    return detalles
      .filter(d => !d.es_incluido_menu)  // ✅ CORRECCIÓN: es_incluido_menu (no es_menu)
      .reduce((sum, d) => sum + parseFloat(d.subtotal), 0);
  };

  // Calcular vuelto
  const calcularVuelto = () => {
    const total = calcularTotal(ordenDetalle?.detalles);
    const pagado = parseFloat(pagoForm.monto_pagado) || 0;
    return Math.max(0, pagado - total);
  };

  // Imprimir ticket (pre-cuenta o comprobante)
  const imprimirComprobante = (venta) => {
    const contenido = `
══════════════════════════
   RESTAURANTE XYZ
   RUC: 20123456789
══════════════════════════
${venta.numero_ticket ? `Ticket #${venta.numero_ticket}` : 'PRE-CUENTA'}
Mesa: ${venta.mesa_numero}
Fecha: ${new Date(venta.created_at || Date.now()).toLocaleString()}
──────────────────────────
${venta.detalles?.filter(d => !d.es_incluido_menu).map(d =>
      `${d.cantidad}x ${d.producto_nombre}\n   S/ ${parseFloat(d.subtotal).toFixed(2)}`
    ).join('\n') || 'Sin productos'}
──────────────────────────
SUBTOTAL:    S/ ${parseFloat(venta.subtotal || 0).toFixed(2)}
IGV (18%):   S/ ${parseFloat(venta.igv || 0).toFixed(2)}
TOTAL:       S/ ${parseFloat(venta.total || 0).toFixed(2)}
──────────────────────────
Método: ${venta.metodo_pago?.toUpperCase() || 'EFECTIVO'}
Pagado:    S/ ${parseFloat(venta.monto_pagado || 0).toFixed(2)}
VUELTO:    S/ ${parseFloat(venta.vuelto || 0).toFixed(2)}
══════════════════════════
    `.trim();

    // Simular impresión (en producción: window.print() o API de impresora)
    console.log('🖨️ COMPROBANTE:\n', contenido);

    // Mostrar en modal para web
    Swal.fire({
      title: '🧾 Comprobante',
      html: `<pre style="text-align:left;font-family:monospace;font-size:11px;white-space:pre-wrap;">${contenido}</pre>`,
      confirmButtonText: '✓ Imprimido',
      width: '400px',
    });
  };

  // Manejar selección de orden
  const handleSeleccionarOrden = (orden) => {
    setOrdenSeleccionada(orden);
    setPagoForm({ metodo_pago: 'efectivo', monto_pagado: '' });
  };

  // Volver a lista
  const handleVolver = () => {
    setOrdenSeleccionada(null);
    setPagoForm({ metodo_pago: 'efectivo', monto_pagado: '' });
  };

  // Imprimir pre-cuenta
  const handleImprimirPreCuenta = () => {
    if (!ordenDetalle) return;

    const preCuenta = {
      ...ordenDetalle,
      numero_ticket: null, // Sin número = pre-cuenta
      created_at: new Date(),
      subtotal: calcularTotal(ordenDetalle.detalles),
      igv: calcularTotal(ordenDetalle.detalles) * 0.18 / 1.18,
      total: calcularTotal(ordenDetalle.detalles),
      metodo_pago: null,
      monto_pagado: null,
      vuelto: null,
      detalles: ordenDetalle.detalles,
    };

    imprimirComprobante(preCuenta);
  };

  // Manejar cobro
  const handleCobrar = () => {
    if (!ordenSeleccionada || !ordenDetalle) return;

    const total = calcularTotal(ordenDetalle.detalles);
    const pagado = parseFloat(pagoForm.monto_pagado) || 0;

    if (pagado < total) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto insuficiente',
        text: `Falta: S/ ${(total - pagado).toFixed(2)}`,
      });
      return;
    }

    Swal.fire({
      title: '¿Confirmar cobro?',
      html: `
        <div style="text-align:left">
          <p><strong>Total:</strong> S/ ${total.toFixed(2)}</p>
          <p><strong>Pagado:</strong> S/ ${pagado.toFixed(2)}</p>
          <p><strong>Vuelto:</strong> S/ ${calcularVuelto().toFixed(2)}</p>
          <p><strong>Método:</strong> ${pagoForm.metodo_pago}</p>
        </div>
      `,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Sí, cobrar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#22c55e',
    }).then((result) => {
      if (result.isConfirmed) {
        cobrarMutation.mutate({
          orden_id: ordenSeleccionada.id,
          metodo_pago: pagoForm.metodo_pago,
          monto_pagado: pagado,
          descuento: 0,
          observaciones: null,
        });
      }
    });
  };

  // ========================================
  // RENDERIZADO
  // ========================================

  if (ordenesLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // VISTA: Lista de órdenes por cobrar
  if (!ordenSeleccionada) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
            <p className="text-gray-500 mt-1">Cobro de órdenes</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/pedidos')}>
            <ArrowLeft className="h-5 w-5 mr-2" /> Ir a Pedidos
          </Button>
        </div>

        {/* Buscador de mesa */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Buscar por N° de mesa..."
                  value={searchMesa}
                  onChange={(e) => setSearchMesa(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchMesa && (
                <Button variant="ghost" onClick={() => setSearchMesa('')}>
                  Limpiar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Lista de órdenes */}
        {ordenesFiltradas?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay órdenes por cobrar</h2>
              <p className="text-gray-500">Todas las órdenes han sido cobradas o están en proceso</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {ordenesFiltradas.map((orden) => {
              const total = orden.detalles?.reduce((s, d) =>
                s + (d.es_incluido_menu ? 0 : parseFloat(d.subtotal)), 0) || 0;

              return (
                <Card
                  key={orden.id}
                  className="cursor-pointer hover:shadow-lg transition-shadow border-l-4 border-l-blue-500"
                  onClick={() => handleSeleccionarOrden(orden)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span>Mesa {orden.mesa_numero}</span>
                      <Badge variant="outline">{orden.estado}</Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Comanda:</span>
                      <span className="font-mono">{orden.numero_comanda?.split('-')[2]}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Items:</span>
                      <span className="font-semibold">{orden.detalles?.filter(d => !d.es_incluido_menu).length || 0}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-500">Total:</span>
                      <span className="font-bold text-blue-600">S/ {orden.total_real ? orden.total_real.toFixed(2) : '0.00'}</span>
                    </div>
                    <Button className="w-full mt-2" size="sm">
                      Cobrar
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // VISTA: Detalle de orden para cobrar
  if (detalleLoading || !ordenDetalle) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={handleVolver}>
          <ArrowLeft className="h-5 w-5 mr-2" /> Volver
        </Button>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  const total = calcularTotal(ordenDetalle.detalles);
  const vuelto = calcularVuelto();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500 mt-1">
            Mesa {ordenDetalle.mesa_numero} - Comanda #{ordenDetalle.numero_comanda?.split('-')[2]}
          </p>
        </div>
        <Button variant="outline" onClick={handleVolver}>
          <ArrowLeft className="h-5 w-5 mr-2" /> Volver
        </Button>
      </div>

      {/* Info de la orden */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" />
            Detalles de la Orden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-sm text-gray-500">Mesa</p><p className="font-semibold">{ordenDetalle.mesa_numero}</p></div>
            <div><p className="text-sm text-gray-500">Estado</p><p className="font-semibold capitalize">{ordenDetalle.estado}</p></div>
            <div><p className="text-sm text-gray-500">Mesero</p><p className="font-semibold">{ordenDetalle.mesero_nombre}</p></div>
            <div><p className="text-sm text-gray-500">Items</p><p className="font-semibold">{ordenDetalle.detalles?.filter(d => !d.es_incluido_menu).length || 0}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Productos de la orden */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Productos</CardTitle>
          </CardHeader>
          <CardContent>
            {ordenDetalle.detalles?.filter(d => !d.es_incluido_menu).length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay productos para cobrar</p>
            ) : (
              <div className="space-y-3">
                {ordenDetalle.detalles?.filter(d => !d.es_incluido_menu).map((detalle) => (
                  <div key={detalle.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-medium text-gray-900">{detalle.producto_nombre}</p>
                      <p className="text-sm text-gray-500">
                        {detalle.cantidad} x S/ {parseFloat(detalle.precio).toFixed(2)}
                      </p>
                    </div>
                    <span className="font-semibold">S/ {parseFloat(detalle.subtotal).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Panel de pago */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Total */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">Total a Pagar:</span>
                <span className="text-2xl font-bold text-blue-600">S/ {total.toFixed(2)}</span>
              </div>
            </div>

            {/* Botón Pre-cuenta */}
            <Button
              variant="outline"
              className="w-full"
              onClick={handleImprimirPreCuenta}
            >
              <Printer className="h-5 w-5 mr-2" /> 🧾 Imprimir Cuenta
            </Button>

            {/* Formulario de pago */}
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-700">Método de Pago</label>
                <select
                  value={pagoForm.metodo_pago}
                  onChange={(e) => setPagoForm(prev => ({ ...prev, metodo_pago: e.target.value }))}
                  className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                >
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta">Tarjeta</option>
                  <option value="yape">Yape</option>
                  <option value="plin">Plin</option>
                  <option value="mixto">Mixto</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700">Monto Pagado</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={pagoForm.monto_pagado}
                  onChange={(e) => setPagoForm(prev => ({ ...prev, monto_pagado: e.target.value }))}
                  className="mt-1"
                />
              </div>

              {/* Vuelto automático */}
              {pagoForm.monto_pagado && (
                <div className={`p-3 rounded-lg ${vuelto > 0 ? 'bg-green-50' : 'bg-gray-50'}`}>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Vuelto:</span>
                    <span className={`font-semibold ${vuelto > 0 ? 'text-green-600' : 'text-gray-900'}`}>
                      S/ {vuelto.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Botón Cobrar */}
            <Button
              onClick={handleCobrar}
              disabled={cobrarMutation.isPending || !pagoForm.monto_pagado || parseFloat(pagoForm.monto_pagado) < total}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              {cobrarMutation.isPending ? 'Procesando...' : '💰 Cobrar y Cerrar'}
            </Button>

            {/* Validación de caja */}
            <p className="text-xs text-gray-500 text-center">
              ⚠️ La caja debe estar abierta para cobrar
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};