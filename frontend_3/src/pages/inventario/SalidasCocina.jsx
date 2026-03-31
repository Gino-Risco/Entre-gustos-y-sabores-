import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChefHat, Plus, Trash2, CheckCircle, XCircle, Clock, Loader2, Save, Eye } from 'lucide-react';
import Swal from 'sweetalert2';
import { salidasCocinaService } from '@/services/salidasCocina.service';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

export const SalidasCocina = () => {
    const queryClient = useQueryClient();
    const [showForm, setShowForm] = useState(false);
    const [turno, setTurno] = useState('manana');
    const [observaciones, setObservaciones] = useState('');
    const [productos, setProductos] = useState([{ producto_id: '', cantidad: '' }]);
    const [productosDisponibles, setProductosDisponibles] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Estados para el Modal de Detalle
    const [salidaSeleccionada, setSalidaSeleccionada] = useState(null);
    const [showDetalleModal, setShowDetalleModal] = useState(false);

    // 1. Fetch de Salidas
    const { data: dataRaw, isLoading } = useQuery({
        queryKey: ['salidas-cocina'],
        queryFn: () => salidasCocinaService.getAll(),
    });

    // SEGURIDAD: Si dataRaw no es una lista, devolvemos una lista vacía [].
    const salidas = Array.isArray(dataRaw) ? dataRaw : (dataRaw?.salidas || []);

    // 2. Cargar productos (insumos) al abrir el formulario
    const handleOpenForm = async () => {
        try {
            const response = await api.get('/productos');
            const allProds = response.data.data.productos || response.data.data;
            const insumos = allProds.filter(p => p.tipo === 'insumo' && p.activo);
            setProductosDisponibles(insumos);
            setShowForm(true);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudieron cargar los insumos' });
        }
    };

    const actualizarProducto = (index, field, value) => {
        const nuevos = [...productos];
        nuevos[index][field] = value;
        setProductos(nuevos);
    };

    // 3. Registrar Nueva Salida
    const handleRegistrar = async () => {
        const detallesValidos = productos.filter(p => p.producto_id && p.cantidad > 0);
        if (detallesValidos.length === 0) {
            Swal.fire({ icon: 'warning', title: 'Datos incompletos', text: 'Agrega al menos un producto con cantidad válida' });
            return;
        }

        setIsSubmitting(true);
        try {
            await salidasCocinaService.create({
                turno,
                observaciones,
                detalles: detallesValidos.map(d => ({
                    producto_id: parseInt(d.producto_id),
                    cantidad: parseFloat(d.cantidad),
                })),
            });

            Swal.fire({ icon: 'success', title: 'Registrado', text: 'Pendiente de aprobación', timer: 2000, showConfirmButton: false });
            setShowForm(false);
            setProductos([{ producto_id: '', cantidad: '' }]);
            setObservaciones('');
            queryClient.invalidateQueries(['salidas-cocina']);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al registrar' });
        } finally {
            setIsSubmitting(false);
        }
    };

    // Función para Cargar el Detalle Completo desde el Backend
    // Función para Cargar el Detalle Completo desde el Backend
    const verDetalle = async (id) => {
        try {
            const data = await salidasCocinaService.getById(id);
            // EXTRAEMOS LA DATA: Si viene envuelta en 'salida', la sacamos. Si no, usamos data directo.
            const detalleReal = data?.salida ? data.salida : data;

            setSalidaSeleccionada(detalleReal);
            setShowDetalleModal(true);
        } catch (error) {
            Swal.fire({ icon: 'error', title: 'Error', text: 'No se pudo cargar el detalle' });
        }
    };

    // 4. Lógica de Aprobación
    const handleAprobar = async (id) => {
        const result = await Swal.fire({
            title: '¿Aprobar salida?',
            text: 'Esta acción descontará el stock definitivamente del inventario.',
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'Sí, aprobar',
            confirmButtonColor: '#22c55e',
        });

        if (result.isConfirmed) {
            try {
                await salidasCocinaService.aprobar(id);
                Swal.fire({ icon: 'success', title: 'Aprobado', timer: 1500, showConfirmButton: false });
                queryClient.invalidateQueries(['salidas-cocina']);
            } catch (error) {
                Swal.fire({ icon: 'error', title: 'Error', text: error.message });
            }
        }
    };

    const formatDate = (date) => new Date(date).toLocaleString('es-PE');

    return (
        <div className="space-y-6 pb-10">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Salidas de Cocina</h1>
                    <p className="text-gray-500 mt-1">Control de insumos consumidos por turno</p>
                </div>
                {!showForm && (
                    <Button onClick={handleOpenForm} className="bg-orange-600 hover:bg-orange-700">
                        <Plus className="h-5 w-5 mr-2" /> Nueva Salida
                    </Button>
                )}
            </div>

            {/* FORMULARIO */}
            {showForm && (
                <Card className="border-orange-200 shadow-md">
                    <CardHeader className="bg-orange-50/50">
                        <CardTitle className="text-orange-800 text-lg flex items-center gap-2">
                            <ChefHat className="h-5 w-5" /> Formulario de Requerimiento
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <Label>Turno de Consumo</Label>
                                <select value={turno} onChange={(e) => setTurno(e.target.value)} className="w-full px-3 py-2 border rounded-md mt-1">
                                    <option value="manana">🌅 Mañana</option>
                                    <option value="tarde">🌆 Tarde</option>
                                    <option value="noche">🌙 Noche</option>
                                </select>
                            </div>
                            <div>
                                <Label>Observaciones Generales</Label>
                                <Input value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Ej: Preparación de base para salsas" className="mt-1" />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <Label>Listado de Insumos</Label>
                            {productos.map((producto, index) => (
                                <div key={index} className="flex gap-3 items-end p-3 bg-gray-50 rounded-lg border border-gray-100">
                                    <div className="flex-1">
                                        <select
                                            value={producto.producto_id}
                                            onChange={(e) => actualizarProducto(index, 'producto_id', e.target.value)}
                                            className="w-full px-3 py-2 border rounded-md bg-white text-sm"
                                        >
                                            <option value="">Seleccionar insumo...</option>
                                            {productosDisponibles.map(p => (
                                                <option key={p.id} value={p.id}>{p.nombre} ({p.unidad_medida})</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="w-32">
                                        <Input type="number" step="0.001" value={producto.cantidad} onChange={(e) => actualizarProducto(index, 'cantidad', e.target.value)} placeholder="Cant." className="bg-white" />
                                    </div>
                                    <Button variant="ghost" size="icon" onClick={() => setProductos(productos.filter((_, i) => i !== index))} disabled={productos.length === 1} className="text-red-500">
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button onClick={() => setProductos([...productos, { producto_id: '', cantidad: '' }])} variant="outline" size="sm" className="w-full border-dashed">
                                <Plus className="h-4 w-4 mr-2" /> Añadir otro insumo
                            </Button>
                        </div>

                        <div className="flex justify-end gap-3 pt-4">
                            <Button variant="ghost" onClick={() => setShowForm(false)}>Cancelar</Button>
                            <Button onClick={handleRegistrar} disabled={isSubmitting} className="bg-orange-600 hover:bg-orange-700">
                                {isSubmitting ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                                Registrar para Aprobación
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* HISTORIAL */}
            <Card>
                <CardHeader><CardTitle className="text-lg">Movimientos Recientes</CardTitle></CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8 text-orange-600" /></div>
                    ) : salidas?.length === 0 ? (
                        <div className="text-center py-12 text-gray-400">
                            <ChefHat className="h-12 w-12 mx-auto mb-2 opacity-20" />
                            <p>No se han registrado consumos de cocina aún.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {salidas.map((salida) => (
                                <div key={salida.id} className={`border rounded-xl p-5 transition-all ${salida.aprobado ? 'bg-white border-gray-100' : 'bg-orange-50/30 border-orange-100'}`}>
                                    <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${salida.aprobado ? 'bg-gray-100' : 'bg-orange-100'}`}>
                                                <Clock className={`h-5 w-5 ${salida.aprobado ? 'text-gray-600' : 'text-orange-600'}`} />
                                            </div>
                                            <div>
                                                <p className="text-sm font-bold text-gray-900">Salida #SC-{salida.id}</p>
                                                <p className="text-xs text-gray-500">{formatDate(salida.created_at)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-3">
                                            <Badge variant="outline" className="capitalize">{salida.turno}</Badge>
                                            <Badge className={salida.aprobado ? 'bg-green-100 text-green-700 border-green-200' : 'bg-yellow-100 text-yellow-700 border-yellow-200'}>
                                                {salida.aprobado ? '✅ Procesada' : '⏳ Pendiente'}
                                            </Badge>

                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => verDetalle(salida.id)}
                                            >
                                                <Eye className="h-4 w-4 mr-2 text-gray-500" /> Detalle
                                            </Button>

                                            {!salida.aprobado && (
                                                <Button
                                                    size="sm"
                                                    className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                                    onClick={() => handleAprobar(salida.id)}
                                                >
                                                    <CheckCircle className="h-4 w-4 mr-2" /> Aprobar Descuento
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Muestra un resumen rápido de hasta 3 productos */}
                                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pl-12">
                                        {salida.detalles?.slice(0, 3).map((det, i) => (
                                            <div key={i} className="flex items-center gap-2 text-sm bg-white p-2 rounded border border-gray-50">
                                                <div className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                                                <span className="text-gray-600">{det.producto_nombre}:</span>
                                                <span className="font-bold text-gray-900">{Number(det.cantidad)} {det.unidad_medida}</span>
                                            </div>
                                        ))}
                                        {salida.detalles?.length > 3 && (
                                            <div className="flex items-center gap-2 text-sm bg-gray-50 p-2 rounded border border-gray-100 text-gray-500">
                                                + {salida.detalles.length - 3} insumos más...
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MODAL DE DETALLE COMPLETO */}
            {showDetalleModal && salidaSeleccionada && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <Card className="w-full max-w-2xl bg-white shadow-2xl">
                        <CardHeader className="border-b pb-4">
                            <div className="flex justify-between items-center">
                                <CardTitle className="text-xl">Detalle de Salida #SC-{salidaSeleccionada.id}</CardTitle>
                                <Button variant="ghost" size="icon" onClick={() => setShowDetalleModal(false)}>
                                    <XCircle className="h-5 w-5 text-gray-500" />
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <div className="grid grid-cols-2 gap-4 mb-6 text-sm bg-gray-50 p-4 rounded-lg">
                                <div><p className="text-gray-500 mb-1">Solicitado por:</p><p className="font-bold text-gray-900">{salidaSeleccionada.usuario_nombre}</p></div>
                                <div><p className="text-gray-500 mb-1">Turno:</p><Badge variant="outline" className="bg-white">{salidaSeleccionada.turno}</Badge></div>
                                <div className="col-span-2"><p className="text-gray-500 mb-1">Observaciones:</p><p className="text-gray-700 italic">{salidaSeleccionada.observaciones || 'Ninguna observación adicional.'}</p></div>
                            </div>

                            <div className="border rounded-lg overflow-hidden">
                                <table className="w-full text-sm">
                                    <thead className="bg-gray-100 text-gray-600">
                                        <tr>
                                            <th className="p-3 text-left font-semibold">Insumo</th>
                                            <th className="p-3 text-center font-semibold">Cantidad</th>
                                            <th className="p-3 text-left font-semibold">Unidad</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y">
                                        {salidaSeleccionada.detalles?.map((det, i) => (
                                            <tr key={i} className="hover:bg-gray-50">
                                                <td className="p-3 font-medium text-gray-900">{det.producto_nombre}</td>
                                                <td className="p-3 text-center font-bold text-orange-600">{Number(det.cantidad)}</td>
                                                <td className="p-3 text-gray-500">{det.unidad_medida}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex justify-end mt-6">
                                <Button onClick={() => setShowDetalleModal(false)} className="bg-gray-800 hover:bg-gray-900 text-white">
                                    Cerrar Detalle
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};