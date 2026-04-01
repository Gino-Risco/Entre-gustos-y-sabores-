import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';
import Swal from 'sweetalert2';
import { comprasService } from '@/services/compras.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const CompraCrear = () => {
    const navigate = useNavigate();
    const [proveedorId, setProveedorId] = useState('');

    // NUEVOS ESTADOS CONTABLES
    const [fechaEmision, setFechaEmision] = useState(new Date().toISOString().split('T')[0]);
    const [tipoComprobante, setTipoComprobante] = useState('Nota de Venta');
    const [serieComprobante, setSerieComprobante] = useState('');
    const [numeroComprobante, setNumeroComprobante] = useState('');
    const [aplicarIgv, setAplicarIgv] = useState(false);
    
    // 👇 1. NUEVO ESTADO PARA EL MÉTODO DE PAGO 👇
    const [metodoPago, setMetodoPago] = useState('efectivo'); 

    const [observaciones, setObservaciones] = useState('');
    const [productos, setProductos] = useState([{ producto_id: '', cantidad: '', costo_unitario: '' }]);
    const [proveedores, setProveedores] = useState([]);
    const [productosDisponibles, setProductosDisponibles] = useState([]);
    const [loading, setLoading] = useState(true);

    // Cargar proveedores y productos al montar
    useEffect(() => {
        cargarDatos();
    }, []);

    // Efecto inteligente: Si cambia a algo distinto de Factura, quitamos el IGV
    useEffect(() => {
        if (tipoComprobante !== 'Factura') {
            setAplicarIgv(false);
        }
    }, [tipoComprobante]);

    const cargarDatos = async () => {
        try {
            const provData = await comprasService.getAllProveedores();
            setProveedores(provData);

            const response = await fetch('/api/productos');
            const data = await response.json();
            // Ahora aceptamos insumos y empacados
            const insumos = data.data.productos.filter(p =>
                (p.tipo === 'insumo' || p.tipo === 'empacado') && p.activo
            ); setProductosDisponibles(insumos);
        } catch (error) {
            console.error('Error cargando datos:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'No se pudieron cargar los datos. Verifica que el backend esté corriendo.'
            });
        } finally {
            setLoading(false);
        }
    };

    const agregarProducto = () => {
        setProductos(prev => [...prev, { producto_id: '', cantidad: '', costo_unitario: '' }]);
    };

    const eliminarProducto = (index) => {
        if (productos.length > 1) {
            setProductos(prev => prev.filter((_, i) => i !== index));
        } else {
            Swal.fire({ icon: 'info', title: 'Información', text: 'Debe haber al menos un producto' });
        }
    };

    const actualizarProducto = (index, field, value) => {
        const nuevos = [...productos];
        nuevos[index][field] = value;
        setProductos(nuevos);
    };

    const calcularSubtotal = (p) => {
        const cantidad = parseFloat(p.cantidad) || 0;
        const costo = parseFloat(p.costo_unitario) || 0;
        return cantidad * costo;
    };

    // NUEVA LÓGICA DE CÁLCULO DE TOTALES
    const sumaBase = productos.reduce((sum, p) => sum + calcularSubtotal(p), 0);
    const igvCalculado = aplicarIgv ? (sumaBase * 0.18) : 0;
    const totalGeneral = sumaBase + igvCalculado;

    const handleGuardar = async () => {
        if (!proveedorId) {
            Swal.fire({ icon: 'warning', title: 'Proveedor requerido', text: 'Selecciona un proveedor' });
            return;
        }

        const detalles = productos.filter(p => p.producto_id && p.cantidad && p.costo_unitario);
        if (detalles.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Productos requeridos', text: 'Agrega al menos un producto con cantidad y costo' });
            return;
        }

        try {
            await comprasService.createCompra({
                proveedor_id: parseInt(proveedorId),
                fecha_emision: fechaEmision,
                tipo_comprobante: tipoComprobante,
                serie_comprobante: serieComprobante || null,
                numero_comprobante: numeroComprobante || null,
                igv: igvCalculado, 
                observaciones,
                // 👇 2. ENVIAMOS EL MÉTODO DE PAGO AL BACKEND 👇
                metodo_pago: metodoPago, 
                detalles: detalles.map(d => ({
                    producto_id: parseInt(d.producto_id),
                    cantidad: parseFloat(d.cantidad),
                    costo_unitario: parseFloat(d.costo_unitario),
                })),
            });

            Swal.fire({
                icon: 'success',
                title: 'Compra registrada',
                text: 'Stock, Kardex y Caja actualizados correctamente',
                timer: 2000,
                showConfirmButton: false
            });
            navigate('/inventario/compras');
        } catch (error) {
            console.error('Error al crear compra:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.error?.message || error.response?.data?.message || 'Error al registrar compra'
            });
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-10">
            <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => navigate('/inventario/compras')}>
                    <ArrowLeft className="h-5 w-5 mr-2" /> Volver
                </Button>
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Nueva Compra</h1>
                    <p className="text-gray-500 mt-1">Registro contable y entrada de insumos</p>
                </div>
            </div>

            <Card>
                <CardHeader><CardTitle>Datos del Comprobante</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                    {/* PRIMERA FILA: Proveedor y Fecha */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Proveedor *</label>
                            <select
                                value={proveedorId}
                                onChange={(e) => setProveedorId(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">Seleccionar proveedor</option>
                                {proveedores.map(p => (
                                    <option key={p.id} value={p.id}>{p.nombre}</option>
                                ))}
                            </select>
                            {proveedores.length === 0 && (
                                <p className="text-sm text-orange-600 mt-1">
                                    ⚠️ No hay proveedores. <Button variant="link" className="p-0 h-auto" onClick={() => navigate('/inventario/proveedores')}>Crear uno</Button>
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Fecha de Emisión *</label>
                            <Input
                                type="date"
                                value={fechaEmision}
                                onChange={(e) => setFechaEmision(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* SEGUNDA FILA: Tipo, Serie y Número */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Tipo de Comprobante *</label>
                            <select
                                value={tipoComprobante}
                                onChange={(e) => setTipoComprobante(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="Nota de Venta">Nota de Venta (Sin IGV)</option>
                                <option value="Factura">Factura</option>
                                <option value="Boleta de Venta">Boleta de Venta</option>
                                <option value="Guía de Remisión">Guía de Remisión</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Serie</label>
                            <Input
                                placeholder="Ej. F001"
                                value={serieComprobante}
                                onChange={(e) => setSerieComprobante(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Número</label>
                            <Input
                                placeholder="Ej. 000456"
                                value={numeroComprobante}
                                onChange={(e) => setNumeroComprobante(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* 👇 3. TERCERA FILA MODIFICADA: Método de Pago y Observaciones 👇 */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-1">Método de Pago *</label>
                            <select
                                value={metodoPago}
                                onChange={(e) => setMetodoPago(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 bg-white"
                            >
                                <option value="efectivo">💵 Efectivo (Descuenta de Caja)</option>
                                <option value="transferencia">🏦 Transferencia Bancaria</option>
                                <option value="credito">⏳ Crédito (Por pagar)</option>
                            </select>
                            {metodoPago === 'efectivo' && (
                                <p className="text-xs text-amber-600 mt-1 font-medium">
                                    * El total se restará automáticamente de la caja abierta.
                                </p>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium mb-1">Observaciones</label>
                            <textarea
                                value={observaciones}
                                onChange={(e) => setObservaciones(e.target.value)}
                                rows="2"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                placeholder="Notas adicionales..."
                            ></textarea>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row justify-between items-center">
                    <CardTitle>Detalle de Productos</CardTitle>
                    <Button onClick={agregarProducto} size="sm" variant="outline" className="border-blue-600 text-blue-600 hover:bg-blue-50">
                        <Plus className="h-4 w-4 mr-2" /> Agregar Fila
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="space-y-3">
                        {productos.map((producto, index) => (
                            <div key={index} className="grid grid-cols-12 gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="col-span-5">
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Producto</label>
                                    <select
                                        value={producto.producto_id}
                                        onChange={(e) => actualizarProducto(index, 'producto_id', e.target.value)}
                                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">Seleccionar producto</option>
                                        {productosDisponibles.map(p => (
                                            <option key={p.id} value={p.id}>
                                                {p.nombre} ({p.unidad_medida || 'unidad'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Cantidad</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={producto.cantidad}
                                        onChange={(e) => actualizarProducto(index, 'cantidad', e.target.value)}
                                        placeholder="0.00"
                                        className="bg-white"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Costo Unit.</label>
                                    <Input
                                        type="number"
                                        step="0.01"
                                        value={producto.costo_unitario}
                                        onChange={(e) => actualizarProducto(index, 'costo_unitario', e.target.value)}
                                        placeholder="0.00"
                                        className="bg-white"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block text-sm font-medium mb-1 text-gray-700">Subtotal</label>
                                    <div className="px-3 py-2 bg-gray-100 border border-gray-200 rounded-md font-semibold text-gray-700">
                                        S/ {calcularSubtotal(producto).toFixed(2)}
                                    </div>
                                </div>
                                <div className="col-span-1 flex justify-center pb-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => eliminarProducto(index)}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-9 w-9"
                                    >
                                        <Trash2 className="h-5 w-5" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* RESUMEN DE TOTALES Y GUARDAR */}
                    <div className="mt-6 pt-4 border-t border-gray-200 flex flex-col md:flex-row justify-between items-end gap-6">

                        {/* Opciones de Impuestos */}
                        <div className="w-full md:w-auto">
                            {tipoComprobante === 'Factura' && (
                                <label className="flex items-center gap-2 p-3 bg-blue-50 border border-blue-100 rounded-lg cursor-pointer hover:bg-blue-100 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={aplicarIgv}
                                        onChange={(e) => setAplicarIgv(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-600"
                                    />
                                    <span className="text-sm font-semibold text-blue-900">Aplicar IGV (18%) al subtotal</span>
                                </label>
                            )}
                        </div>

                        {/* Cuadro de Totales */}
                        <div className="w-full md:w-64 space-y-2 bg-gray-50 p-4 rounded-lg border border-gray-200">
                            <div className="flex justify-between text-sm text-gray-600">
                                <span>Subtotal (Base):</span>
                                <span className="font-medium">S/ {sumaBase.toFixed(2)}</span>
                            </div>

                            {aplicarIgv && (
                                <div className="flex justify-between text-sm text-gray-600">
                                    <span>IGV (18%):</span>
                                    <span className="font-medium">S/ {igvCalculado.toFixed(2)}</span>
                                </div>
                            )}

                            <div className="flex justify-between text-xl font-bold text-gray-900 pt-2 border-t border-gray-300">
                                <span>Total:</span>
                                <span className="text-blue-600">S/ {totalGeneral.toFixed(2)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="outline" size="lg" onClick={() => navigate('/inventario/compras')}>
                            Cancelar
                        </Button>
                        <Button size="lg" onClick={handleGuardar} className="bg-blue-600 hover:bg-blue-700">
                            Guardar Compra
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};