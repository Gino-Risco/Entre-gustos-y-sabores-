import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Printer, ArrowLeft, AlertCircle, FileText } from 'lucide-react';
import Swal from 'sweetalert2';
import { comprasService } from '@/services/compras.service';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const CompraDetalle = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const { data: compra, isLoading, refetch } = useQuery({
    queryKey: ['compra', id],
    queryFn: async () => await comprasService.getCompraById(id),
    enabled: !!id,
  });

  // Helper para el comprobante
  const formatComprobante = (comp) => {
    if (!comp) return 'S/N';
    const tipo = comp.tipo_comprobante || 'Nota de Venta';
    const serie = comp.serie_comprobante ? `${comp.serie_comprobante}-` : '';
    const numero = comp.numero_comprobante || 'S/N';
    if (tipo === 'Nota de Venta' && !comp.serie_comprobante && !comp.numero_comprobante) return tipo;
    return `${tipo} ${serie}${numero}`;
  };

  const handleImprimir = () => {
    const contenido = `
════════════════════════════════════
    ORDEN DE COMPRA #${compra.numero_compra}
════════════════════════════════════
Proveedor: ${compra.proveedor_nombre}
Doc:       ${formatComprobante(compra)}
Fecha:     ${new Date(compra.fecha_emision || compra.created_at).toLocaleDateString('es-PE', { timeZone: 'UTC' })}
Usuario:   ${compra.usuario_nombre}
────────────────────────────────────
PRODUCTOS:
────────────────────────────────────
${compra.detalles.map(d => `${d.producto_nombre}
  Cant: ${d.cantidad} | Costo: S/${parseFloat(d.costo_unitario).toFixed(2)}
  Subtotal: S/${parseFloat(d.subtotal).toFixed(2)}`).join('\n')}
────────────────────────────────────
${parseFloat(compra.igv) > 0 ? `Subtotal Base: S/ ${parseFloat(compra.subtotal).toFixed(2)}\nIGV (18%):     S/ ${parseFloat(compra.igv).toFixed(2)}\n` : ''}TOTAL:         S/ ${parseFloat(compra.total).toFixed(2)}
════════════════════════════════════
    `;
    Swal.fire({ 
      title: '🧾 Detalle de Compra', 
      html: `<pre style="text-align:left;font-family:monospace;font-size:12px;background:#f8f9fa;padding:15px;border-radius:8px;">${contenido}</pre>`, 
      confirmButtonText: '✓ Cerrar', 
      width: '450px' 
    });
  };

  const handleAnular = async () => {
    const { value: motivo, isConfirmed } = await Swal.fire({
      title: '¿Anular compra?',
      html: `Se revertirá el stock ingresado a tu almacén.<br><br><b>Motivo de anulación:</b>`,
      icon: 'warning',
      input: 'textarea',
      inputPlaceholder: 'Ingresa el motivo (Ej: Error en registro)...',
      showCancelButton: true,
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) => !value.trim() && 'El motivo es requerido',
    });

    if (isConfirmed && motivo) {
      try {
        await comprasService.anularCompra(id, motivo);
        Swal.fire({ icon: 'success', title: 'Compra anulada', text: 'Stock revertido correctamente', timer: 2000, showConfirmButton: false });
        refetch(); // Actualiza la vista actual sin salir de la página
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || error.message });
      }
    }
  };

  if (isLoading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;
  if (!compra) return <div className="text-center py-12 text-gray-500">Compra no encontrada</div>;

  return (
    <div className="space-y-6 pb-10">
      {/* CABECERA */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="outline" onClick={() => navigate('/inventario/compras')}><ArrowLeft className="h-5 w-5 mr-2" /> Volver</Button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              Compra #{compra.numero_compra}
              <Badge variant={compra.activo ? 'default' : 'destructive'} className={compra.activo ? 'bg-blue-100 text-blue-800' : ''}>
                {compra.activo ? 'Activa' : 'Anulada'}
              </Badge>
            </h1>
            <p className="text-gray-500 mt-1">{compra.proveedor_nombre}</p>
          </div>
        </div>
        <div className="flex gap-2">
          {compra.activo && (
            <>
              <Button onClick={handleImprimir} variant="outline" className="border-blue-200 text-blue-700 hover:bg-blue-50">
                <Printer className="h-5 w-5 mr-2" /> Imprimir
              </Button>
              <Button onClick={handleAnular} variant="outline" className="text-red-600 border-red-200 hover:bg-red-50">
                <AlertCircle className="h-5 w-5 mr-2" /> Anular
              </Button>
            </>
          )}
        </div>
      </div>

      {/* TARJETAS DE RESUMEN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-1"><FileText className="h-4 w-4 text-gray-400"/> <p className="text-sm text-gray-500">Documento</p></div>
            <p className="font-semibold">{formatComprobante(compra)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 mb-1">Fecha de Emisión</p>
            <p className="font-semibold">{new Date(compra.fecha_emision || compra.created_at).toLocaleDateString('es-PE', { timeZone: 'UTC' })}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 mb-1">Registrado por</p>
            <p className="font-semibold">{compra.usuario_nombre}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-500 mb-1">Observaciones</p>
            <p className="font-semibold text-sm truncate" title={compra.observaciones || 'Ninguna'}>
              {compra.observaciones || 'Ninguna'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* DETALLE DE PRODUCTOS */}
      <Card>
        <CardHeader><CardTitle>Productos Ingresados</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b text-sm text-gray-600">
                  <th className="text-left py-3 px-4">Producto</th>
                  <th className="text-center py-3 px-4">U.M.</th>
                  <th className="text-right py-3 px-4">Cantidad</th>
                  <th className="text-right py-3 px-4">Costo Unit.</th>
                  <th className="text-right py-3 px-4">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {compra.detalles.map((detalle) => (
                  <tr key={detalle.id} className={`border-b ${!compra.activo ? 'opacity-50' : ''}`}>
                    <td className="py-3 px-4 font-medium">{detalle.producto_nombre}</td>
                    <td className="py-3 px-4 text-center text-sm text-gray-500">{detalle.unidad_medida || '-'}</td>
                    <td className="py-3 px-4 text-right">{detalle.cantidad}</td>
                    <td className="py-3 px-4 text-right text-gray-600">S/ {parseFloat(detalle.costo_unitario).toFixed(2)}</td>
                    <td className="py-3 px-4 text-right font-semibold">S/ {parseFloat(detalle.subtotal).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
              
              {/* TOTALES CONTABLES */}
              <tfoot className="bg-gray-50">
                {parseFloat(compra.igv) > 0 && (
                  <>
                    <tr>
                      <td colSpan="4" className="text-right py-3 px-4 text-sm font-medium text-gray-600">Subtotal (Base):</td>
                      <td className="text-right py-3 px-4 text-sm font-semibold text-gray-700">S/ {parseFloat(compra.subtotal).toFixed(2)}</td>
                    </tr>
                    <tr className="border-b border-gray-200">
                      <td colSpan="4" className="text-right py-3 px-4 text-sm font-medium text-gray-600">IGV (18%):</td>
                      <td className="text-right py-3 px-4 text-sm font-semibold text-gray-700">S/ {parseFloat(compra.igv).toFixed(2)}</td>
                    </tr>
                  </>
                )}
                <tr>
                  <td colSpan="4" className="text-right py-4 px-4 font-bold text-gray-900 uppercase">Total General:</td>
                  <td className="text-right py-4 px-4 font-bold text-xl text-blue-600">S/ {parseFloat(compra.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};