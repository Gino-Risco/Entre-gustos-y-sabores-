import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, Plus, Minus, DollarSign, CreditCard, Smartphone, ArrowLeft, Filter, Download } from 'lucide-react';
import Swal from 'sweetalert2';
import { cajaService } from '@/services/caja.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

export const Caja = () => {
    const queryClient = useQueryClient();

    const [showAperturaModal, setShowAperturaModal] = useState(false);
    const [showMovimientoModal, setShowMovimientoModal] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [tipoMovimiento, setTipoMovimiento] = useState('ingreso');
    const [formMovimiento, setFormMovimiento] = useState({ concepto: '', monto: '' });
    const [formCierre, setFormCierre] = useState({
        turno: 'manana',
        monto_real: '',
        observaciones: '',
    });
    const [filtroMovimientos, setFiltroMovimientos] = useState({ tipo: 'todos' });

    // Fetch: ¿Hay caja abierta?
    const { data: estadoCaja, isLoading: cajaLoading } = useQuery({
        queryKey: ['caja-estado'],
        queryFn: async () => {
            return await cajaService.verificarCajaAbierta();  // ✅ usa el service
        },
        staleTime: 30000,
    });
    const cajaAbierta = estadoCaja?.caja;
    const hayCajaAbierta = estadoCaja?.caja_abierta;

    // Fetch: Resumen del día (solo si hay caja abierta)
    const { data: resumen, isLoading: resumenLoading } = useQuery({
        queryKey: ['caja-resumen', cajaAbierta?.id],
        queryFn: async () => {
            if (!cajaAbierta?.id) return null;
            return await cajaService.getResumenDelDia();
        },
        enabled: !!cajaAbierta?.id,
        staleTime: 10000,
    });

    // Fetch: Movimientos del día
    const { data: movimientos, isLoading: movimientosLoading } = useQuery({
        queryKey: ['caja-movimientos', cajaAbierta?.id, filtroMovimientos],
        queryFn: async () => {
            if (!cajaAbierta?.id) return [];
            return await cajaService.getMovimientosDelDia(cajaAbierta.id, filtroMovimientos);
        },
        enabled: !!cajaAbierta?.id,
        staleTime: 5000,
    });

    // Mutation: Abrir caja
    const abrirCajaMutation = useMutation({
        mutationFn: async (data) => {
            return await cajaService.abrirCaja(data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['caja-abierta']);
            queryClient.invalidateQueries(['caja-resumen']);
            setShowAperturaModal(false);
            Swal.fire({ icon: 'success', title: 'Caja abierta', timer: 1500, showConfirmButton: false });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al abrir caja' });
        },
    });

    // Mutation: Registrar movimiento
    const registrarMovimientoMutation = useMutation({
        mutationFn: async (data) => {
            return await cajaService.registrarMovimiento({
                caja_id: cajaAbierta.id,
                // 1. Enviar el tipo real ('ingreso' o 'gasto'/'egreso')
                tipo: tipoMovimiento === 'ingreso' ? 'ingreso' : 'gasto',

                // 2. Enviar el monto SIEMPRE en positivo
                monto: parseFloat(data.monto),
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['caja-resumen']);
            queryClient.invalidateQueries(['caja-movimientos']);
            setShowMovimientoModal(false);
            setFormMovimiento({ concepto: '', monto: '' });
            Swal.fire({ icon: 'success', title: 'Movimiento registrado', timer: 1500, showConfirmButton: false });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al registrar' });
        },
    });

    // Mutation: Cerrar caja
    const cerrarCajaMutation = useMutation({
        mutationFn: async (data) => {
            return await cajaService.cerrarCaja(cajaAbierta.id, {
                turno: data.turno,
                total_efectivo: resumen?.cards?.efectivo?.monto || 0,
                total_tarjeta: resumen?.cards?.tarjeta?.monto || 0,
                total_otro: (resumen?.cards?.yape?.monto || 0) + (resumen?.cards?.plin?.monto || 0),
                monto_final_real: parseFloat(data.monto_real),
                observaciones: data.observaciones,
            });
        },
        onSuccess: (cierre) => {
            // 1. Corregimos la caché para que actualice la pantalla al instante
            queryClient.invalidateQueries(['caja-estado']);
            queryClient.invalidateQueries(['caja-resumen']);
            setShowCierreModal(false);

            // 2. Le pasamos el turno manualmente para que el ticket no explote
            cierre.turno = formCierre.turno;

            // 3. Imprimimos el ticket y mostramos éxito
            imprimirReporteCierre(cierre);

            Swal.fire({
                icon: 'success',
                title: 'Caja cerrada',
                text: `Diferencia: S/ ${cierre.diferencia.toFixed(2)}`,
                timer: 2000,
                showConfirmButton: false
            });

            // 4. Limpiamos el formulario para el siguiente turno
            setFormCierre({ turno: 'manana', monto_real: '', observaciones: '' });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al cerrar' });
        },
    });

    // Imprimir reporte de cierre
    // Imprimir reporte de cierre (VERSIÓN SEGURA)
    const imprimirReporteCierre = (cierre) => {
        // 1. Forzamos la conversión a números para que JavaScript no explote
        const fondo = parseFloat(cierre.monto_inicial || 0);
        const ventas = parseFloat(cierre.total_ventas || 0);

        // Dependiendo de tu backend, extraemos ingresos y egresos
        const ingresos = parseFloat(cierre.resumen?.total_ingresos || cierre.ingresos_manuales || 0);
        const egresos = parseFloat(cierre.resumen?.total_gastos || 0) + parseFloat(cierre.resumen?.total_retiros || 0);

        const esperado = parseFloat(cierre.monto_final_esperado || 0);
        const real = parseFloat(cierre.monto_final_real || 0);
        const dif = parseFloat(cierre.diferencia || 0);
        const turnoStr = String(cierre.turno || 'N/A').toUpperCase();

        const contenido = `
══════════════════════════
   REPORTE DE CIERRE
   Turno: ${turnoStr}
══════════════════════════
Fecha: ${new Date(cierre.created_at || Date.now()).toLocaleString()}
Cajero: ${cierre.usuario_nombre || 'Usuario'}
──────────────────────────
📊 RESUMEN DEL TURNO
──────────────────────────
Fondo Inicial:      S/ ${fondo.toFixed(2)}
+ Ventas:           S/ ${ventas.toFixed(2)}
+ Ingresos:         S/ ${ingresos.toFixed(2)}
- Egresos:          S/ ${egresos.toFixed(2)}
──────────────────────────
SALDO ESPERADO:     S/ ${esperado.toFixed(2)}
SALDO REAL:         S/ ${real.toFixed(2)}
──────────────────────────
DIFERENCIA:         S/ ${dif.toFixed(2)}
${dif < 0 ? '⚠️ Faltante' : dif > 0 ? '✓ Sobrante' : '✓ Cuadre perfecto'}
──────────────────────────
${cierre.observaciones ? `Obs: ${cierre.observaciones}` : ''}
══════════════════════════
        `.trim();

        console.log('🖨️ REPORTE CIERRE:\n', contenido);
        Swal.fire({
            title: '🧾 Reporte de Cierre',
            html: `<pre style="text-align:left;font-family:monospace;font-size:11px;white-space:pre-wrap;">${contenido}</pre>`,
            confirmButtonText: '✓ Imprimido',
            width: '450px',
        });
    };

    // Handlers
    const handleAbrirCaja = (data) => {
        abrirCajaMutation.mutate({
            monto_inicial: parseFloat(data.monto_inicial),
            observaciones: data.observaciones,
        });
    };

    const handleRegistrarMovimiento = () => {
        if (!formMovimiento.concepto || !formMovimiento.monto) {
            Swal.fire({ icon: 'warning', title: 'Campos requeridos', text: 'Completa concepto y monto' });
            return;
        }
        registrarMovimientoMutation.mutate(formMovimiento);
    };

    const handleCerrarCaja = () => {
        if (!formCierre.monto_real) {
            Swal.fire({ icon: 'warning', title: 'Monto requerido', text: 'Ingresa el monto real contado' });
            return;
        }
        cerrarCajaMutation.mutate(formCierre);
    };

    const formatMonto = (monto) => `S/ ${parseFloat(monto || 0).toFixed(2)}`;

    // ========================================
    // RENDERIZADO
    // ========================================

    if (cajaLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // VISTA: No hay caja abierta → Mostrar botón para abrir
    if (!cajaAbierta) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Caja</h1>
                        <p className="text-gray-500 mt-1">Control de efectivo y turnos</p>
                    </div>
                    <Button variant="outline" onClick={() => window.history.back()}>
                        <ArrowLeft className="h-5 w-5 mr-2" /> Volver
                    </Button>
                </div>

                <Card className="max-w-md mx-auto">
                    <CardHeader>
                        <CardTitle className="text-center">🔓 Abrir Caja</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-gray-600 text-center">
                            No hay una caja abierta. Registra el fondo inicial para comenzar el turno.
                        </p>

                        <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.target);
                            handleAbrirCaja({
                                monto_inicial: formData.get('monto_inicial'),
                                observaciones: formData.get('observaciones'),
                            });
                        }} className="space-y-4">
                            <div>
                                <Label htmlFor="monto_inicial">Fondo Inicial (S/)</Label>
                                <Input
                                    name="monto_inicial"
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    placeholder="100.00"
                                    required
                                    className="mt-1"
                                />
                            </div>
                            <div>
                                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                                <Input
                                    name="observaciones"
                                    placeholder="Ej: Turno mañana"
                                    className="mt-1"
                                />
                            </div>
                            <Button
                                type="submit"
                                className="w-full bg-green-600 hover:bg-green-700"
                                disabled={abrirCajaMutation.isPending}
                            >
                                {abrirCajaMutation.isPending ? 'Abriendo...' : '🔓 Abrir Caja'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // VISTA: Caja abierta → Dashboard completo
    if (resumenLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Caja</h1>
                    <p className="text-gray-500 mt-1">
                        Turno: {cajaAbierta.usuario_nombre} • Apertura: {new Date(cajaAbierta.created_at).toLocaleTimeString()}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Badge className="bg-green-600">🟢 ABIERTA</Badge>
                    <Button variant="outline" onClick={() => window.history.back()}>
                        <ArrowLeft className="h-5 w-5 mr-2" /> Volver
                    </Button>
                </div>
            </div>

            {/* Cards de Métodos de Pago */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {Object.values(resumen?.cards || {}).map((card) => (
                    <Card key={card.label} className={card.label === 'Total' ? 'border-2 border-blue-500 bg-blue-50' : ''}>
                        <CardContent className="pt-6 text-center">
                            <div className="text-3xl mb-2">{card.icon}</div>
                            <p className="text-sm text-gray-500">{card.label}</p>
                            <p className="text-xl font-bold text-gray-900">{formatMonto(card.monto)}</p>
                            <p className="text-xs text-gray-400">{card.ventas} ventas</p>
                        </CardContent>
                    </Card>
                ))}
            </div>

            {/* Resumen Numérico */}
            <Card>
                <CardHeader>
                    <CardTitle>📊 Resumen del Turno</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div><p className="text-sm text-gray-500">Fondo Inicial</p><p className="font-semibold">{formatMonto(resumen?.resumen?.fondo_inicial)}</p></div>
                        <div><p className="text-sm text-gray-500">Total Ventas</p><p className="font-semibold text-blue-600">{formatMonto(resumen?.resumen?.total_ventas)}</p></div>
                        <div><p className="text-sm text-gray-500">Ingresos Manuales</p><p className="font-semibold text-green-600">{formatMonto(resumen?.resumen?.ingresos_manuales)}</p></div>
                        <div><p className="text-sm text-gray-500">Egresos Manuales</p><p className="font-semibold text-red-600">- {formatMonto(resumen?.resumen?.egresos_manuales)}</p></div>
                        <div className="bg-gray-100 p-2 rounded"><p className="text-sm text-gray-700 font-medium">Saldo Esperado</p><p className="font-bold text-lg">{formatMonto(resumen?.resumen?.saldo_esperado)}</p></div>
                    </div>
                </CardContent>
            </Card>

            {/* Botones de Acción */}
            <div className="flex flex-wrap gap-3">
                <Button onClick={() => { setTipoMovimiento('ingreso'); setShowMovimientoModal(true); }} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-5 w-5 mr-2" /> Registrar Ingreso
                </Button>
                <Button onClick={() => { setTipoMovimiento('egreso'); setShowMovimientoModal(true); }} variant="outline" className="border-red-300 text-red-600 hover:bg-red-50">
                    <Minus className="h-5 w-5 mr-2" /> Registrar Egreso
                </Button>
                <Button onClick={() => setShowCierreModal(true)} className="bg-orange-600 hover:bg-orange-700">
                    🔒 Cerrar Turno
                </Button>
            </div>

            {/* Historial de Movimientos */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>📋 Historial de Movimientos</CardTitle>
                    <Select value={filtroMovimientos.tipo} onValueChange={(value) => setFiltroMovimientos({ tipo: value })}>
                        <SelectTrigger className="w-40">
                            <SelectValue placeholder="Filtrar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos</SelectItem>
                            <SelectItem value="apertura">Apertura</SelectItem>
                            <SelectItem value="venta">Ventas</SelectItem>
                            <SelectItem value="ingreso">Ingresos</SelectItem>
                            <SelectItem value="retiro">Retiros</SelectItem>
                            <SelectItem value="gasto">Gastos</SelectItem>
                            <SelectItem value="cierre">Cierre</SelectItem>
                        </SelectContent>
                    </Select>
                </CardHeader>
                <CardContent>
                    {movimientosLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : movimientos?.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No hay movimientos registrados</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b">
                                        <th className="text-left py-3 px-4">Fecha</th>
                                        <th className="text-left py-3 px-4">Tipo</th>
                                        <th className="text-left py-3 px-4">Descripción</th>
                                        <th className="text-right py-3 px-4">Monto</th>
                                        <th className="text-left py-3 px-4">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos?.map((mov) => {
                                        // Normalizar movimientos: retiros negativos son ingresos
                                        const tipoMostrado = mov.tipo === 'retiro' && mov.monto < 0 ? 'ingreso' : mov.tipo;
                                        const montoMostrado = Math.abs(mov.monto);
                                        const signo = ['venta', 'ingreso', 'apertura'].includes(tipoMostrado) ? '+' : '-';
                                        return (
                                            <tr key={mov.id} className="border-b hover:bg-gray-50">
                                                <td className="py-3 px-4 text-sm">{new Date(mov.created_at).toLocaleTimeString()}</td>
                                                <td className="py-3 px-4">
                                                    <Badge variant={
                                                        tipoMostrado === 'venta' ? 'default' :
                                                            tipoMostrado === 'ingreso' ? 'success' :
                                                                ['retiro', 'gasto'].includes(tipoMostrado) ? 'destructive' : 'secondary'
                                                    }>
                                                        {tipoMostrado}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 text-sm">
                                                    {mov.descripcion || (mov.numero_ticket ? `Venta #${mov.numero_ticket}` : '-')}
                                                    {mov.metodo_pago_venta && <span className="block text-xs text-gray-400">{mov.metodo_pago_venta}</span>}
                                                </td>
                                                <td className="py-3 px-4 text-right font-semibold">
                                                    {signo}{formatMonto(montoMostrado)}
                                                </td>
                                                <td className="py-3 px-4 text-sm text-gray-500">{mov.usuario_nombre}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* MODAL: Registrar Movimiento */}
            <Dialog open={showMovimientoModal} onOpenChange={setShowMovimientoModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {tipoMovimiento === 'ingreso' ? '💵 Registrar Ingreso' : '💸 Registrar Egreso'}
                        </DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleRegistrarMovimiento();
                    }} className="space-y-4">
                        <div>
                            <Label>Concepto</Label>
                            <Input
                                value={formMovimiento.concepto}
                                onChange={(e) => setFormMovimiento(prev => ({ ...prev, concepto: e.target.value }))}
                                placeholder={tipoMovimiento === 'ingreso' ? 'Ej: Cliente devuelve adelanto' : 'Ej: Compra de bolsas'}
                                required
                            />
                        </div>
                        <div>
                            <Label>Monto (S/)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formMovimiento.monto}
                                onChange={(e) => setFormMovimiento(prev => ({ ...prev, monto: e.target.value }))}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            ℹ️ Los movimientos manuales se registran solo en efectivo
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowMovimientoModal(false)}>Cancelar</Button>
                            <Button type="submit" className={tipoMovimiento === 'ingreso' ? 'bg-green-600' : 'bg-red-600'}>
                                {registrarMovimientoMutation.isPending ? 'Registrando...' : 'Registrar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* MODAL: Cerrar Caja */}
            <Dialog open={showCierreModal} onOpenChange={setShowCierreModal}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>🔒 Cerrar Turno</DialogTitle>
                    </DialogHeader>
                    <form onSubmit={(e) => {
                        e.preventDefault();
                        handleCerrarCaja();
                    }} className="space-y-4">
                        {/* Selección de turno */}
                        <div>
                            <Label>Turno</Label>
                            <Select value={formCierre.turno} onValueChange={(value) => setFormCierre(prev => ({ ...prev, turno: value }))}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Selecciona turno" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="manana">🌅 Mañana</SelectItem>
                                    <SelectItem value="tarde">🌙 Tarde</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Saldo esperado vs real */}
                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Saldo Esperado:</span>
                                <span className="font-semibold">{formatMonto(resumen?.resumen?.saldo_esperado)}</span>
                            </div>
                            <div>
                                <Label>Monto Real Contado (S/)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    value={formCierre.monto_real}
                                    onChange={(e) => setFormCierre(prev => ({ ...prev, monto_real: e.target.value }))}
                                    placeholder="0.00"
                                    required
                                    className="mt-1"
                                />
                            </div>
                            {formCierre.monto_real && (
                                <div className={`flex justify-between p-2 rounded ${(parseFloat(formCierre.monto_real) - (resumen?.resumen?.saldo_esperado || 0)) < 0
                                    ? 'bg-red-50 text-red-700'
                                    : (parseFloat(formCierre.monto_real) - (resumen?.resumen?.saldo_esperado || 0)) > 0
                                        ? 'bg-green-50 text-green-700'
                                        : 'bg-blue-50 text-blue-700'
                                    }`}>
                                    <span>Diferencia:</span>
                                    <span className="font-bold">
                                        {formatMonto(parseFloat(formCierre.monto_real) - (resumen?.resumen?.saldo_esperado || 0))}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Observaciones */}
                        <div>
                            <Label>Observaciones (opcional)</Label>
                            <Input
                                value={formCierre.observaciones}
                                onChange={(e) => setFormCierre(prev => ({ ...prev, observaciones: e.target.value }))}
                                placeholder="Ej: Faltante por cambio mal dado"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowCierreModal(false)}>Cancelar</Button>
                            <Button
                                type="submit"
                                className="bg-orange-600 hover:bg-orange-700"
                                disabled={cerrarCajaMutation.isPending || cerrarCajaMutation.isLoading}
                            >
                                {cerrarCajaMutation.isPending || cerrarCajaMutation.isLoading ? 'Cerrando...' : '🔒 Confirmar Cierre'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};                                                                                                              