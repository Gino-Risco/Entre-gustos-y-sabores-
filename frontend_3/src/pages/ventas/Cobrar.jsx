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
  const { data: ordenes, isLoading: ordenesLoading } = useQuery({
    queryKey: ['ordenes-por-cobrar'],
    queryFn: async () => {
      const data = await ventasService.getOrdenesPorCobrar();
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
      const cajaEstado = await ventasService.verificarCajaAbierta();
      if (!cajaEstado.caja_abierta) {
        throw new Error('La caja debe estar abierta para cobrar');
      }
      return await ventasService.crear(data);
    },
    onSuccess: (venta) => {
      queryClient.invalidateQueries(['ordenes-por-cobrar']);

      const ventaParaImprimir = {
        ...ordenDetalle,
        ...venta,
      };

      imprimirComprobante(ventaParaImprimir);
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

  // Filtrar órdenes por mesa O por nombre de cliente
  const ordenesFiltradas = ordenes?.filter((orden) => {
    if (!searchMesa) return true;
    const searchTermLowercase = searchMesa.toLowerCase();

    const matchMesa = orden?.mesa_numero?.toString().toLowerCase().includes(searchTermLowercase);
    const matchCliente = orden?.nombre_cliente?.toLowerCase().includes(searchTermLowercase);

    return matchMesa || matchCliente;
  });

  // Calcular total bruto de la orden
  const calcularTotal = (detalles) => {
    if (!detalles) return 0;
    return detalles
      .filter(d => !d.es_incluido_menu)
      .reduce((sum, d) => sum + parseFloat(d.subtotal), 0);
  };

  // --- NUEVAS MATEMÁTICAS CON DESCUENTO ---
  const calcularTotalFinal = () => {
    const subtotal = calcularTotal(ordenDetalle?.detalles);
    const descuento = parseFloat(ordenDetalle?.descuento_total || 0);
    return Math.max(0, subtotal - descuento);
  };

  const calcularVuelto = () => {
    const totalAPagar = calcularTotalFinal();
    const pagado = parseFloat(pagoForm.monto_pagado) || 0;
    return Math.max(0, pagado - totalAPagar);
  };
  // ----------------------------------------

  // Imprimir ticket (pre-cuenta o comprobante)
  const imprimirComprobante = (venta, esPreCuenta = false) => {
    const identificador = !venta.mesa_id
      ? `CLIENTE: ${venta.nombre_cliente || 'Para Llevar'}`
      : `Mesa: ${venta.mesa_numero}`;

    // 🧮 LÓGICA MATEMÁTICA CORRECTA PARA TICKETS
    const subtotalBruto = parseFloat(venta.subtotal || calcularTotal(venta.detalles));
    const descuentoTicket = parseFloat(venta.descuento_total || 0);
    const totalTicket = parseFloat(venta.total || (subtotalBruto - descuentoTicket));
    
    // IGV extraído del total final
    const subtotalSinIgv = totalTicket / 1.18;
    const igvCalculado = totalTicket - subtotalSinIgv;

    let contenido = '';

    if (esPreCuenta) {
      // 📄 DISEÑO DE PRE-CUENTA
      contenido = `
══════════════════════════
   RESTAURANTE XYZ
══════════════════════════
      *** PRE-CUENTA ***
${identificador}
Fecha: ${new Date().toLocaleString()}
──────────────────────────
${venta.detalles?.filter(d => !d.es_incluido_menu).map(d =>
        `${d.cantidad}x ${d.producto_nombre}\n   S/ ${parseFloat(d.subtotal).toFixed(2)}`
      ).join('\n') || 'Sin productos'}
──────────────────────────
SUBTOTAL BRUTO: S/ ${subtotalBruto.toFixed(2)}
${descuentoTicket > 0 ? `DESCUENTO:    - S/ ${descuentoTicket.toFixed(2)}\n` : ''}──────────────────────────
OP. GRAVADA:   S/ ${subtotalSinIgv.toFixed(2)}
IGV (18%):     S/ ${igvCalculado.toFixed(2)}
TOTAL:         S/ ${totalTicket.toFixed(2)}
──────────────────────────
 *** ESTE DOCUMENTO NO ES ***
 *** UN COMPROBANTE DE PAGO ***
══════════════════════════
      `.trim();
      console.log('📋 GENERANDO PRE-CUENTA:\n', contenido);

    } else {
      // 🧾 DISEÑO DE TICKET FINAL
      contenido = `
══════════════════════════
   RESTAURANTE XYZ
   RUC: 20123456789
══════════════════════════
TICKET #${venta.numero_ticket || 'S/N'}
${identificador}
Fecha: ${new Date(venta.created_at || Date.now()).toLocaleString()}
──────────────────────────
${venta.detalles?.filter(d => !d.es_incluido_menu).map(d =>
        `${d.cantidad}x ${d.producto_nombre}\n   S/ ${parseFloat(d.subtotal).toFixed(2)}`
      ).join('\n') || 'Sin productos'}
──────────────────────────
SUBTOTAL BRUTO: S/ ${subtotalBruto.toFixed(2)}
${descuentoTicket > 0 ? `DESCUENTO:    - S/ ${descuentoTicket.toFixed(2)}\n` : ''}──────────────────────────
OP. GRAVADA:   S/ ${subtotalSinIgv.toFixed(2)}
IGV (18%):     S/ ${igvCalculado.toFixed(2)}
TOTAL:         S/ ${totalTicket.toFixed(2)}
──────────────────────────
Método: ${venta.metodo_pago?.toUpperCase() || 'EFECTIVO'}
Pagado:    S/ ${parseFloat(venta.monto_pagado || 0).toFixed(2)}
VUELTO:    S/ ${parseFloat(venta.vuelto || 0).toFixed(2)}
══════════════════════════
   ¡Gracias por su compra!
      `.trim();
      console.log('🖨️ COMPROBANTE FINAL:\n', contenido);
    }

    Swal.fire({
      title: esPreCuenta ? '🧾 Pre-Cuenta' : '🧾 Comprobante',
      html: `<pre style="text-align:left;font-family:monospace;font-size:12px;white-space:pre-wrap;">${contenido}</pre>`,
      confirmButtonText: '✓ Entendido',
      confirmButtonColor: esPreCuenta ? '#3b82f6' : '#22c55e',
      width: '400px',
    });
  };

  const handleSeleccionarOrden = (orden) => {
    setOrdenSeleccionada(orden);
    setPagoForm({ metodo_pago: 'efectivo', monto_pagado: '' });
  };

  const handleVolver = () => {
    setOrdenSeleccionada(null);
    setPagoForm({ metodo_pago: 'efectivo', monto_pagado: '' });
  };

  // Imprimir pre-cuenta
  const handleImprimirPreCuenta = () => {
    if (!ordenDetalle) return;

    const subtotalBruto = calcularTotal(ordenDetalle.detalles);
    const descuento = parseFloat(ordenDetalle.descuento_total || 0);
    const totalNeto = Math.max(0, subtotalBruto - descuento);

    const preCuenta = {
      ...ordenDetalle,
      subtotal: subtotalBruto,
      descuento_total: descuento,
      total: totalNeto,
    };

    imprimirComprobante(preCuenta, true);
  };

  // Manejar cobro
  const handleCobrar = () => {
    if (!ordenSeleccionada || !ordenDetalle) return;

    const subtotalBruto = calcularTotal(ordenDetalle.detalles);
    const descuentoAplicado = parseFloat(ordenDetalle.descuento_total || 0);
    const totalAPagar = Math.max(0, subtotalBruto - descuentoAplicado);
    
    const pagado = parseFloat(pagoForm.monto_pagado) || 0;
    const vueltoCalculado = Math.max(0, pagado - totalAPagar);

    if (pagado < totalAPagar) {
      Swal.fire({
        icon: 'warning',
        title: 'Monto insuficiente',
        text: `Falta: S/ ${(totalAPagar - pagado).toFixed(2)}`,
      });
      return;
    }

    Swal.fire({
      title: '¿Confirmar cobro?',
      html: `
        <div style="text-align:left">
          <p><strong>Total Bruto:</strong> S/ ${subtotalBruto.toFixed(2)}</p>
          ${descuentoAplicado > 0 ? `<p style="color:#ea580c"><strong>Descuento:</strong> - S/ ${descuentoAplicado.toFixed(2)}</p>` : ''}
          <p style="font-size: 1.2em; color: #2563eb; margin: 8px 0;"><strong>Total a Pagar: S/ ${totalAPagar.toFixed(2)}</strong></p>
          <p><strong>Pagado:</strong> S/ ${pagado.toFixed(2)}</p>
          <p><strong>Vuelto:</strong> S/ ${vueltoCalculado.toFixed(2)}</p>
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
          descuento: descuentoAplicado,
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
            <p className="text-gray-500 mt-1">Selecciona una orden para cobrar</p>
          </div>
          <Button variant="outline" onClick={() => navigate('/pedidos')}>
            <ArrowLeft className="h-5 w-5 mr-2" /> Ir a Pedidos
          </Button>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  placeholder="Buscar N° de mesa o nombre de cliente..."
                  value={searchMesa}
                  onChange={(e) => setSearchMesa(e.target.value)}
                  className="pl-10"
                />
              </div>
              {searchMesa && (
                <Button variant="ghost" onClick={() => setSearchMesa('')}>Limpiar</Button>
              )}
            </div>
          </CardContent>
        </Card>

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
              const esLlevar = !orden.mesa_id;

              return (
                <Card
                  key={orden.id}
                  className={`cursor-pointer hover:shadow-lg transition-shadow border-l-4 ${esLlevar ? 'border-l-orange-500' : 'border-l-blue-500'}`}
                  onClick={() => handleSeleccionarOrden(orden)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span>{esLlevar ? `🛍️ ${orden.nombre_cliente || 'Para Llevar'}` : `Mesa ${orden?.mesa_numero}`}</span>
                      <Badge variant="outline">{orden?.estado}</Badge>
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
                    {parseFloat(orden.descuento_total || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-orange-500">Descuento:</span>
                        <span className="font-semibold text-orange-600">- S/ {parseFloat(orden.descuento_total).toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-sm font-bold">
                      <span className="text-gray-700">Total:</span>
                      {/* ✅ CORRECCIÓN DOBLE RESTA AQUÍ */}
                      <span className="text-blue-600">S/ {parseFloat(orden.total_real || orden.total || 0).toFixed(2)}</span>
                    </div>
                    <Button className={`w-full mt-2 ${esLlevar ? 'bg-orange-500 hover:bg-orange-600' : ''}`} size="sm">
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

  // ✅ PREPARAR VARIABLES HTML
  const subtotalItems = calcularTotal(ordenDetalle.detalles);
  const descuentoAplicado = parseFloat(ordenDetalle.descuento_total || 0);
  const totalAPagar = calcularTotalFinal();
  
  const vuelto = calcularVuelto();
  const esLlevarDetalle = !ordenDetalle.mesa_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Ventas</h1>
          <p className="text-gray-500 mt-1">
            {esLlevarDetalle ? `🛍️ CLIENTE: ${ordenDetalle.nombre_cliente || 'Para Llevar'}` : `Mesa ${ordenDetalle?.mesa_numero}`} - Comanda #{ordenDetalle?.numero_comanda?.split('-')[2]}
          </p>
        </div>
        <Button variant="outline" onClick={handleVolver}>
          <ArrowLeft className="h-5 w-5 mr-2" /> Volver
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-blue-600" /> Detalles de la Orden
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-500">{esLlevarDetalle ? 'Cliente' : 'Mesa'}</p>
              <p className="font-semibold">{esLlevarDetalle ? (ordenDetalle.nombre_cliente || 'Para Llevar') : ordenDetalle.mesa_numero}</p>
            </div>
            <div><p className="text-sm text-gray-500">Estado</p><p className="font-semibold capitalize">{ordenDetalle.estado}</p></div>
            <div><p className="text-sm text-gray-500">Mesero</p><p className="font-semibold">{ordenDetalle.mesero_nombre}</p></div>
            <div><p className="text-sm text-gray-500">Items</p><p className="font-semibold">{ordenDetalle.detalles?.filter(d => !d.es_incluido_menu).length || 0}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" /> Pago
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            
            {/* ✅ PANEL DE TOTALES ACTUALIZADO */}
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex justify-between items-center text-gray-600 mb-1 text-sm">
                <span>Subtotal:</span>
                <span>S/ {subtotalItems.toFixed(2)}</span>
              </div>
              {descuentoAplicado > 0 && (
                <div className="flex justify-between items-center text-orange-600 font-medium mb-2 text-sm border-b border-blue-200 pb-2">
                  <span>Descuento:</span>
                  <span>- S/ {descuentoAplicado.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between items-center mt-2">
                <span className="text-lg font-semibold text-gray-800">Total a Pagar:</span>
                <span className="text-2xl font-bold text-blue-600">S/ {totalAPagar.toFixed(2)}</span>
              </div>
            </div>

            <Button variant="outline" className="w-full" onClick={handleImprimirPreCuenta}>
              <Printer className="h-5 w-5 mr-2" /> 🧾 Imprimir Cuenta
            </Button>

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

            <Button
              onClick={handleCobrar}
              disabled={cobrarMutation.isPending || !pagoForm.monto_pagado || parseFloat(pagoForm.monto_pagado) < totalAPagar}
              className="w-full bg-green-600 hover:bg-green-700"
            >
              <DollarSign className="h-5 w-5 mr-2" />
              {cobrarMutation.isPending ? 'Procesando...' : '💰 Cobrar y Cerrar'}
            </Button>

            <p className="text-xs text-gray-500 text-center">
              ⚠️ La caja debe estar abierta para cobrar
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};