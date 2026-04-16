import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Printer, Plus, Minus, DollarSign, CreditCard, Smartphone, ArrowLeft, Filter, Download, Calculator, Wallet, FileText, Unlock } from 'lucide-react';
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
    const [vista, setVista] = useState('historial');

    if (vista === 'dashboard') {
        return <VistaDashboard onVolver={() => setVista('historial')} />;
    }

    return <VistaHistorial onIrADashboard={() => setVista('dashboard')} />;
};

// ─────────────────────────────────────────────
// UMBRAL DE DIFERENCIA QUE DISPARA ADVERTENCIA
// ─────────────────────────────────────────────
const UMBRAL_DIFERENCIA_ALERTA = 50; // S/ 50

// ─────────────────────────────────────────────
// UTILIDAD: parsear fechas del backend (que vienen sin zona horaria explícita)
// y mostrarlas correctamente en hora local del navegador (Lima = UTC-5).
// ─────────────────────────────────────────────
const parseFecha = (rawDate) => {
    if (!rawDate) return new Date();
    // Si ya trae indicador de zona (Z o +XX:XX) lo dejamos tal cual.
    // Si no, asumimos que el backend entrega en UTC y forzamos el 'Z'.
    const str = String(rawDate);
    const tieneZona = str.endsWith('Z') || /[+-]\d{2}:\d{2}$/.test(str);
    return new Date(tieneZona ? str : str + 'Z');
};

const VistaDashboard = ({ onVolver }) => {
    const queryClient = useQueryClient();

    const [showMovimientoModal, setShowMovimientoModal] = useState(false);
    const [showCierreModal, setShowCierreModal] = useState(false);
    const [showArqueoModal, setShowArqueoModal] = useState(false);

    const [tipoMovimiento, setTipoMovimiento] = useState('ingreso');
    const [formMovimiento, setFormMovimiento] = useState({ concepto: '', monto: '' });
    const [formArqueo, setFormArqueo] = useState({ monto_contado: '', observaciones: '' });
    const [formCierre, setFormCierre] = useState({
        turno: 'manana',
        monto_real: '',
        fondo_reservado_proximo: '',
        observaciones: '',
    });
    const [filtroMovimientos, setFiltroMovimientos] = useState({ tipo: 'todos' });

    // FIX #1 — Rastrear localmente si se realizó al menos un arqueo en este turno.
    // Se activa cuando registrarArqueoMutation tiene éxito.
    const [huboArqueo, setHuboArqueo] = useState(false);

    // ── QUERIES ──────────────────────────────────────────────────────────────

    const { data: estadoCaja, isLoading: cajaLoading } = useQuery({
        queryKey: ['caja-estado'],
        queryFn: () => cajaService.verificarCajaAbierta(),
        staleTime: 30000,
    });

    const cajaAbierta = estadoCaja?.caja;
    const hayCajaAbierta = estadoCaja?.caja_abierta;

    // FIX #4 — Solo disparar cuando sabemos con certeza que NO hay caja abierta
    // (hayCajaAbierta === false en lugar de !hayCajaAbierta, que era truthy con undefined).
    const { data: fondoSugerido, isLoading: fondoLoading } = useQuery({
        queryKey: ['caja-fondo-sugerido'],
        queryFn: () => cajaService.obtenerFondoSugerido(),
        enabled: hayCajaAbierta === false,
        staleTime: 0,
    });

    const { data: resumen, isLoading: resumenLoading } = useQuery({
        queryKey: ['caja-resumen', cajaAbierta?.id],
        queryFn: () => {
            if (!cajaAbierta?.id) return null;
            return cajaService.getResumenDelDia();
        },
        enabled: !!cajaAbierta?.id,
        // FIX #5 — Reducir staleTime para que el resumen esté lo más fresco posible
        // justo antes de que el usuario abra el modal de cierre.
        staleTime: 5000,
    });

    const { data: movimientos, isLoading: movimientosLoading } = useQuery({
        queryKey: ['caja-movimientos', cajaAbierta?.id, filtroMovimientos],
        queryFn: () => {
            if (!cajaAbierta?.id) return [];
            return cajaService.getMovimientosDelDia(cajaAbierta.id, filtroMovimientos);
        },
        enabled: !!cajaAbierta?.id,
        staleTime: 5000,
    });

    // ── MUTATIONS ────────────────────────────────────────────────────────────

    const abrirCajaMutation = useMutation({
        mutationFn: (data) => cajaService.abrirCaja(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['caja-estado'] });
            queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });
            queryClient.invalidateQueries({ queryKey: ['caja-fondo-sugerido'] }); // FIX #3
            Swal.fire({ icon: 'success', title: 'Caja abierta', timer: 1500, showConfirmButton: false });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al abrir caja' });
        },
    });

    const registrarMovimientoMutation = useMutation({
        mutationFn: (data) =>
            cajaService.registrarMovimiento({
                caja_id: cajaAbierta.id,
                tipo: tipoMovimiento === 'ingreso' ? 'ingreso' : 'gasto',
                monto: parseFloat(data.monto),
                descripcion: data.concepto,
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });
            queryClient.invalidateQueries({ queryKey: ['caja-movimientos'] });
            setShowMovimientoModal(false);
            setFormMovimiento({ concepto: '', monto: '' });
            Swal.fire({ icon: 'success', title: 'Movimiento registrado', timer: 1500, showConfirmButton: false });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al registrar' });
        },
    });

    const registrarArqueoMutation = useMutation({
        mutationFn: (data) => cajaService.registrarArqueoParcial(cajaAbierta.id, data),
        onSuccess: (data) => {
            // FIX #1 — Marcar que ya se realizó un arqueo exitoso
            setHuboArqueo(true);

            setShowArqueoModal(false);
            setFormArqueo({ monto_contado: '', observaciones: '' });
            const dif = parseFloat(data.arqueo.diferencia);
            Swal.fire({
                icon: dif === 0 ? 'success' : 'warning',
                title: 'Arqueo Registrado',
                html: `Diferencia: <b>S/ ${dif.toFixed(2)}</b><br/>${dif < 0 ? '⚠️ Faltante en caja' : dif > 0 ? '✓ Sobrante en caja' : '✓ Cuadre perfecto'}`,
            });
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al registrar arqueo' });
        },
    });

    const cerrarCajaMutation = useMutation({
        mutationFn: (data) =>
            cajaService.cerrarCaja(cajaAbierta.id, {
                turno: data.turno,
                // FIX #5 — Estos valores son informativos; el backend debe recalcularlos.
                // Los enviamos igual para compatibilidad, pero el backend es la fuente de verdad.
                total_efectivo: resumen?.cards?.efectivo?.monto || 0,
                total_tarjeta: resumen?.cards?.tarjeta?.monto || 0,
                total_otro: (resumen?.cards?.yape?.monto || 0) + (resumen?.cards?.plin?.monto || 0),
                monto_final_real: parseFloat(data.monto_real),
                fondo_reservado_proximo: parseFloat(data.fondo_reservado_proximo || 0),
                observaciones: data.observaciones,
            }),
        onSuccess: (response) => {
            const cierre = response.cierre;

            queryClient.invalidateQueries({ queryKey: ['caja-estado'] });
            queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });
            queryClient.invalidateQueries({ queryKey: ['caja-historial'] });
            queryClient.invalidateQueries({ queryKey: ['caja-fondo-sugerido'] }); // FIX #3

            setShowCierreModal(false);
            cierre.turno = formCierre.turno;

            imprimirReporteCierre(cierre);

            Swal.fire({
                icon: 'success',
                title: 'Caja cerrada',
                text: `Diferencia: S/ ${parseFloat(cierre.diferencia).toFixed(2)}`,
                timer: 2000,
                showConfirmButton: false,
            });

            setFormCierre({ turno: 'manana', monto_real: '', fondo_reservado_proximo: '', observaciones: '' });
            setHuboArqueo(false); // Resetear para el próximo turno
            onVolver();
        },
        onError: (error) => {
            Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al cerrar' });
        },
    });

    // ── HANDLERS ─────────────────────────────────────────────────────────────

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
        if (parseFloat(formMovimiento.monto) <= 0) {
            Swal.fire({ icon: 'warning', title: 'Monto inválido', text: 'El monto debe ser mayor a 0' });
            return;
        }
        registrarMovimientoMutation.mutate(formMovimiento);
    };

    // FIX #1, #2, #6 — Validaciones completas antes de cerrar caja
    const handleCerrarCaja = async () => {
        // Validación 1: monto_real obligatorio
        if (!formCierre.monto_real || parseFloat(formCierre.monto_real) < 0) {
            Swal.fire({ icon: 'warning', title: 'Monto requerido', text: 'Ingresa el monto real contado en caja' });
            return;
        }

        // FIX #1 — Validar que se haya hecho un arqueo previo
        if (!huboArqueo) {
            Swal.fire({
                icon: 'warning',
                title: 'Arqueo requerido',
                text: 'Debes realizar al menos un Corte / Arqueo antes de cerrar el turno.',
                confirmButtonText: 'Entendido',
            });
            return;
        }

        const montoReal = parseFloat(formCierre.monto_real);
        const fondoProximo = parseFloat(formCierre.fondo_reservado_proximo || 0);

        // FIX #6 — Validar que fondo para mañana no supere el monto real
        if (fondoProximo > montoReal) {
            Swal.fire({
                icon: 'error',
                title: 'Distribución inválida',
                text: `El fondo para mañana (S/ ${fondoProximo.toFixed(2)}) no puede ser mayor al monto real contado (S/ ${montoReal.toFixed(2)}).`,
            });
            return;
        }

        // FIX #2 — Alerta si la diferencia con el sistema es muy grande
        const saldoEsperado = parseFloat(resumen?.resumen?.saldo_esperado || 0);
        const diferencia = Math.abs(montoReal - saldoEsperado);
        if (diferencia > UMBRAL_DIFERENCIA_ALERTA) {
            const result = await Swal.fire({
                icon: 'warning',
                title: `⚠️ Diferencia alta: S/ ${diferencia.toFixed(2)}`,
                html: `El sistema esperaba <b>S/ ${saldoEsperado.toFixed(2)}</b> y estás cerrando con <b>S/ ${montoReal.toFixed(2)}</b>.<br/><br/>¿Estás seguro de que el monto ingresado es correcto?`,
                showCancelButton: true,
                confirmButtonText: 'Sí, cerrar igual',
                cancelButtonText: 'Revisar monto',
                confirmButtonColor: '#f97316',
                cancelButtonColor: '#6b7280',
            });
            if (!result.isConfirmed) return;
        }

        // FIX #5 — Refrescar resumen justo antes de cerrar para tener los totales más recientes
        await queryClient.invalidateQueries({ queryKey: ['caja-resumen'] });

        cerrarCajaMutation.mutate({
            ...formCierre,
            fondo_reservado_proximo: fondoProximo,
        });
    };

    const handleExportarExcel = () => {
        if (!movimientos || movimientos.length === 0) {
            Swal.fire('Vacío', 'No hay movimientos para exportar', 'info');
            return;
        }

        const filtroNombre = filtroMovimientos.tipo !== 'todos' ? `_${filtroMovimientos.tipo}` : '';
        const cabeceras = ['Fecha', 'Hora', 'Tipo', 'Descripción', 'Método Pago', 'Monto (S/)', 'Usuario'];
        const filas = movimientos.map((mov) => {
            // FIX #10 — Usar parseFecha para respetar zona horaria
            const fechaObj = parseFecha(mov.created_at);
            const fecha = fechaObj.toLocaleDateString('es-PE');
            const hora = fechaObj.toLocaleTimeString('es-PE');
            const tipoMostrado = mov.tipo === 'retiro' && mov.monto < 0 ? 'ingreso' : mov.tipo;
            const descripcion = (mov.descripcion || (mov.numero_ticket ? `Venta #${mov.numero_ticket}` : '-')).replace(/,/g, '');
            const metodo = (mov.metodo_pago_venta || '-').replace(/,/g, '');
            const monto = Math.abs(mov.monto).toFixed(2);
            const signo = ['venta', 'ingreso', 'apertura'].includes(tipoMostrado) ? '+' : '-';
            const usuario = (mov.usuario_nombre || '-').replace(/,/g, '');
            return `"${fecha}","${hora}","${tipoMostrado.toUpperCase()}","${descripcion}","${metodo.toUpperCase()}","${signo}${monto}","${usuario}"`;
        });

        const csvContent = '\uFEFF' + cabeceras.join(',') + '\n' + filas.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        // FIX #9 — El nombre del archivo refleja el filtro activo
        link.setAttribute('download', `Movimientos_Caja${filtroNombre}_${new Date().getTime()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url); // Liberar memoria
    };

    const handleImprimirPDF = () => {
        window.print();
    };

    const imprimirReporteCierre = (cierre) => {
        const fondo = parseFloat(cierre.monto_inicial || 0);
        const ventasGlobales = parseFloat(cierre.total_ventas || 0);
        const ventasEfectivo = parseFloat(cierre.total_efectivo || 0);
        const ventasTarjeta = parseFloat(cierre.total_tarjeta || 0);
        const ventasDigital = parseFloat(cierre.total_otro || 0);
        const ingresos = parseFloat(cierre.total_ingresos || 0);
        const egresos = parseFloat(cierre.total_gastos || 0) + parseFloat(cierre.total_retiros || 0);
        const esperadoFisico = parseFloat(cierre.monto_final_esperado || 0);
        const realFisico = parseFloat(cierre.monto_final_real || 0);
        const dif = parseFloat(cierre.diferencia || 0);
        const fondoManana = parseFloat(cierre.fondo_reservado_proximo || 0);
        const retiroDueno = parseFloat(cierre.monto_retirado_dueno || 0);
        const turnoStr = String(cierre.turno || 'N/A').toUpperCase();
        // FIX #8 — Fallback robusto para usuario_nombre
        const cajeroNombre = cierre.usuario_nombre || cierre.cajero_nombre || cajaAbierta?.usuario_nombre || 'Usuario';

        const contenido = `
══════════════════════════
   REPORTE DE CIERRE
   Turno: ${turnoStr}
══════════════════════════
Fecha: ${parseFecha(cierre.created_at).toLocaleString('es-PE')}
Cajero: ${cajeroNombre}
──────────────────────────
📊 1. CONTROL DE VENTAS (TOTAL)
──────────────────────────
Efectivo:           S/ ${ventasEfectivo.toFixed(2)}
Tarjeta:            S/ ${ventasTarjeta.toFixed(2)}
Yape/Plin:          S/ ${ventasDigital.toFixed(2)}
--------------------------
TOTAL VENTAS DÍA:   S/ ${ventasGlobales.toFixed(2)}

──────────────────────────
💵 2. CONTROL DE GAVETA (FÍSICO)
──────────────────────────
Fondo Inicial:      S/ ${fondo.toFixed(2)}
+ Ventas Efectivo:  S/ ${ventasEfectivo.toFixed(2)}
+ Ingresos Extras:  S/ ${ingresos.toFixed(2)}
- Egresos Extras:   S/ ${egresos.toFixed(2)}
--------------------------
SALDO ESPERADO:     S/ ${esperadoFisico.toFixed(2)}
SALDO REAL CONTADO: S/ ${realFisico.toFixed(2)}
--------------------------
DIFERENCIA:         S/ ${dif.toFixed(2)}
${dif < 0 ? '⚠️ FALTANTE' : dif > 0 ? '✓ SOBRANTE' : '✓ CUADRE PERFECTO'}

──────────────────────────
💰 3. DISTRIBUCIÓN DEL EFECTIVO
──────────────────────────
Fondo p/ Mañana:    S/ ${fondoManana.toFixed(2)}
Retiro Dueño:       S/ ${retiroDueno.toFixed(2)}
──────────────────────────
${cierre.observaciones ? `Obs: ${cierre.observaciones}` : ''}
══════════════════════════
        `.trim();

        console.log(contenido);

        Swal.fire({
            title: '🧾 Reporte de Cierre',
            html: `<pre style="text-align:left;font-family:monospace;font-size:11px;white-space:pre-wrap;">${contenido}</pre>`,
            confirmButtonText: '✓ Entendido',
            width: '450px',
        });
    };

    const formatMonto = (monto) => `S/ ${parseFloat(monto || 0).toFixed(2)}`;

    // ── RENDERS DE ESTADO ────────────────────────────────────────────────────

    if (cajaLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!hayCajaAbierta) {
        return (
            <div className="space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900">Caja</h1>
                        <p className="text-gray-500 mt-1">Control de efectivo y turnos</p>
                    </div>
                    <Button variant="outline" onClick={onVolver}>
                        <ArrowLeft className="h-5 w-5 mr-2" /> Volver al Historial
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
                        {fondoLoading ? (
                            <div className="flex justify-center">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    const formData = new FormData(e.target);
                                    handleAbrirCaja({
                                        monto_inicial: formData.get('monto_inicial'),
                                        observaciones: formData.get('observaciones'),
                                    });
                                }}
                                className="space-y-4"
                            >
                                <div>
                                    <Label htmlFor="monto_inicial">Fondo Inicial (S/)</Label>
                                    <Input
                                        key={fondoSugerido}
                                        name="monto_inicial"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={fondoSugerido || ''}
                                        placeholder="0.00"
                                        required
                                        className="mt-1"
                                    />
                                    {fondoSugerido > 0 && (
                                        <p className="text-xs text-blue-600 mt-1">✓ Sugerido del cierre anterior</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                                    <Input name="observaciones" placeholder="Ej: Turno mañana" className="mt-1" />
                                </div>
                                <Button
                                    type="submit"
                                    className="w-full bg-green-600 hover:bg-green-700"
                                    disabled={abrirCajaMutation.isPending}
                                >
                                    {abrirCajaMutation.isPending ? 'Abriendo...' : '🔓 Abrir Caja'}
                                </Button>
                            </form>
                        )}
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (resumenLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    // ── RENDER PRINCIPAL ─────────────────────────────────────────────────────

    return (
        <div className="space-y-6 print:m-0 print:space-y-4">
            {/* Cabecera */}
            <div className="flex items-center justify-between print:hidden">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Caja</h1>
                    <p className="text-gray-500 mt-1">
                        Turno: {cajaAbierta.usuario_nombre} • Apertura:{' '}
                        {parseFecha(cajaAbierta.created_at).toLocaleTimeString('es-PE')}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Badge className="bg-green-600">🟢 ABIERTA</Badge>
                    <Button variant="outline" onClick={onVolver}>
                        <ArrowLeft className="h-5 w-5 mr-2" /> Volver al Historial
                    </Button>
                </div>
            </div>

            {/* Cards de resumen por método de pago */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 print:hidden">
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

            {/* Encabezado solo para impresión */}
            <div className="hidden print:block text-center mb-4">
                <h2 className="text-2xl font-bold">Reporte de Turno en Caja</h2>
                <p className="text-gray-500">
                    Cajero: {cajaAbierta?.usuario_nombre} • Fecha:{' '}
                    {new Date().toLocaleDateString('es-PE')}
                </p>
                <hr className="my-2 border-gray-300" />
            </div>

            {/* Resumen del turno */}
            <Card className="print:shadow-none print:border-gray-200">
                <CardHeader className="print:pb-2">
                    <CardTitle>📊 Resumen del Turno</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div>
                            <p className="text-sm text-gray-500">Fondo Inicial</p>
                            <p className="font-semibold">{formatMonto(resumen?.resumen?.fondo_inicial)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ventas (Solo Efectivo)</p>
                            <p className="font-semibold text-blue-600">{formatMonto(resumen?.resumen?.ventas_efectivo)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Ingresos Manuales</p>
                            <p className="font-semibold text-green-600">{formatMonto(resumen?.resumen?.ingresos_manuales)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-500">Egresos Manuales</p>
                            <p className="font-semibold text-red-600">- {formatMonto(resumen?.resumen?.egresos_manuales)}</p>
                        </div>
                        <div className="bg-gray-100 p-2 rounded print:bg-transparent print:border print:border-gray-300">
                            <p className="text-sm text-gray-700 font-medium">Saldo Esperado Físico</p>
                            <p className="font-bold text-lg">{formatMonto(resumen?.resumen?.saldo_esperado)}</p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Botones de acción */}
            <div className="flex flex-wrap gap-3 print:hidden">
                <Button
                    onClick={() => { setTipoMovimiento('ingreso'); setShowMovimientoModal(true); }}
                    className="bg-green-600 hover:bg-green-700"
                >
                    <Plus className="h-5 w-5 mr-2" /> Registrar Ingreso
                </Button>
                <Button
                    onClick={() => { setTipoMovimiento('egreso'); setShowMovimientoModal(true); }}
                    variant="outline"
                    className="border-red-300 text-red-600 hover:bg-red-50"
                >
                    <Minus className="h-5 w-5 mr-2" /> Registrar Egreso
                </Button>
                <Button
                    onClick={() => setShowArqueoModal(true)}
                    variant="secondary"
                    className="bg-blue-100 text-blue-700 hover:bg-blue-200"
                >
                    <Calculator className="h-5 w-5 mr-2" /> Corte / Arqueo
                </Button>
                {/* FIX #1 — Indicador visual de que aún falta el arqueo */}
                {!huboArqueo && (
                    <span className="flex items-center text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-1">
                        ⚠️ Debes hacer un Arqueo antes de cerrar
                    </span>
                )}
                <Button
                    onClick={() => setShowCierreModal(true)}
                    className="bg-orange-600 hover:bg-orange-700 ml-auto"
                >
                    🔒 Cerrar Turno
                </Button>
            </div>

            {/* Tabla de movimientos */}
            <Card className="print:shadow-none print:border-gray-200">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 print:hidden">
                    <CardTitle>📋 Historial de Movimientos</CardTitle>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Select
                            value={filtroMovimientos.tipo}
                            onValueChange={(value) => setFiltroMovimientos({ tipo: value })}
                        >
                            <SelectTrigger className="w-40 h-10">
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
                        <Button
                            variant="outline"
                            className="h-10 text-emerald-600 border-emerald-200 hover:bg-emerald-50 whitespace-nowrap"
                            onClick={handleExportarExcel}
                        >
                            <Download className="h-4 w-4 mr-2" /> Excel
                        </Button>
                        <Button
                            variant="outline"
                            className="h-10 text-rose-600 border-rose-200 hover:bg-rose-50 whitespace-nowrap"
                            onClick={handleImprimirPDF}
                        >
                            <Printer className="h-4 w-4 mr-2" /> PDF
                        </Button>
                    </div>
                </CardHeader>

                <div className="hidden print:block px-6 pt-4">
                    <h3 className="text-lg font-bold">Detalle de Operaciones</h3>
                </div>

                <CardContent className="print:px-0">
                    {movimientosLoading ? (
                        <div className="flex justify-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : movimientos?.length === 0 ? (
                        <p className="text-gray-500 text-center py-8">No hay movimientos registrados</p>
                    ) : (
                        <div className="overflow-x-auto print:overflow-visible">
                            <table className="w-full print:text-xs">
                                <thead>
                                    <tr className="border-b print:bg-gray-100">
                                        <th className="text-left py-3 px-4 print:py-2">Fecha</th>
                                        <th className="text-left py-3 px-4 print:py-2">Tipo</th>
                                        <th className="text-left py-3 px-4 print:py-2">Descripción</th>
                                        <th className="text-right py-3 px-4 print:py-2">Monto</th>
                                        <th className="text-left py-3 px-4 print:py-2">Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {movimientos?.map((mov) => {
                                        const tipoMostrado = mov.tipo === 'retiro' && mov.monto < 0 ? 'ingreso' : mov.tipo;
                                        const montoMostrado = Math.abs(mov.monto);
                                        const signo = ['venta', 'ingreso', 'apertura'].includes(tipoMostrado) ? '+' : '-';
                                        return (
                                            <tr key={mov.id} className="border-b hover:bg-gray-50 print:border-gray-200">
                                                {/* FIX #10 — Hora con timezone correcto */}
                                                <td className="py-3 px-4 print:py-2 text-sm">
                                                    {parseFecha(mov.created_at).toLocaleTimeString('es-PE')}
                                                </td>
                                                <td className="py-3 px-4 print:py-2">
                                                    <Badge
                                                        variant={
                                                            tipoMostrado === 'venta'
                                                                ? 'default'
                                                                : tipoMostrado === 'ingreso'
                                                                ? 'success'
                                                                : ['retiro', 'gasto'].includes(tipoMostrado)
                                                                ? 'destructive'
                                                                : 'secondary'
                                                        }
                                                        className="print:border-none print:p-0 print:bg-transparent print:text-black"
                                                    >
                                                        {tipoMostrado.toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="py-3 px-4 print:py-2 text-sm">
                                                    {mov.descripcion || (mov.numero_ticket ? `Venta #${mov.numero_ticket}` : '-')}
                                                    {mov.metodo_pago_venta && (
                                                        <span className="block text-xs text-gray-400 print:text-gray-600">
                                                            {mov.metodo_pago_venta.toUpperCase()}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="py-3 px-4 print:py-2 text-right font-semibold">
                                                    {signo}{formatMonto(montoMostrado)}
                                                </td>
                                                <td className="py-3 px-4 print:py-2 text-sm text-gray-500">
                                                    {mov.usuario_nombre}
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

            {/* ── MODAL: Registrar Movimiento ── */}
            <Dialog open={showMovimientoModal} onOpenChange={setShowMovimientoModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>
                            {tipoMovimiento === 'ingreso' ? '💵 Registrar Ingreso' : '💸 Registrar Egreso'}
                        </DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleRegistrarMovimiento();
                        }}
                        className="space-y-4"
                    >
                        <div>
                            <Label>Concepto</Label>
                            <Input
                                value={formMovimiento.concepto}
                                onChange={(e) => setFormMovimiento((prev) => ({ ...prev, concepto: e.target.value }))}
                                placeholder={tipoMovimiento === 'ingreso' ? 'Ej: Cliente devuelve adelanto' : 'Ej: Compra de bolsas'}
                                required
                            />
                        </div>
                        <div>
                            <Label>Monto (S/)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0.01"
                                value={formMovimiento.monto}
                                onChange={(e) => setFormMovimiento((prev) => ({ ...prev, monto: e.target.value }))}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <p className="text-xs text-gray-500">
                            ℹ️ Los movimientos manuales se registran solo en efectivo
                        </p>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowMovimientoModal(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                className={tipoMovimiento === 'ingreso' ? 'bg-green-600' : 'bg-red-600'}
                                disabled={registrarMovimientoMutation.isPending}
                            >
                                {registrarMovimientoMutation.isPending ? 'Registrando...' : 'Registrar'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── MODAL: Arqueo ── */}
            <Dialog open={showArqueoModal} onOpenChange={setShowArqueoModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>⚖️ Corte / Arqueo de Caja</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            registrarArqueoMutation.mutate(formArqueo);
                        }}
                        className="space-y-4"
                    >
                        <p className="text-sm text-gray-600">
                            Ingresa cuánto dinero físico hay en la caja en este momento. El sistema calculará
                            la diferencia sin cerrar el turno.
                        </p>
                        <div>
                            <Label>Monto Contado en Efectivo (S/)</Label>
                            <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={formArqueo.monto_contado}
                                onChange={(e) => setFormArqueo((prev) => ({ ...prev, monto_contado: e.target.value }))}
                                placeholder="0.00"
                                required
                            />
                        </div>
                        <div>
                            <Label>Observaciones (opcional)</Label>
                            <Input
                                value={formArqueo.observaciones}
                                onChange={(e) => setFormArqueo((prev) => ({ ...prev, observaciones: e.target.value }))}
                            />
                        </div>
                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowArqueoModal(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                className="bg-blue-600"
                                disabled={registrarArqueoMutation.isPending}
                            >
                                {registrarArqueoMutation.isPending ? 'Verificando...' : 'Registrar Arqueo'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* ── MODAL: Cierre de Turno ── */}
            <Dialog open={showCierreModal} onOpenChange={setShowCierreModal}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle>🔒 Cerrar Turno</DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            handleCerrarCaja();
                        }}
                        className="space-y-4"
                    >
                        {/* FIX #1 — Aviso dentro del modal si no hay arqueo */}
                        {!huboArqueo && (
                            <div className="flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-amber-800 text-sm">
                                <span className="text-lg leading-none">⚠️</span>
                                <span>
                                    Aún no has realizado un <strong>Corte / Arqueo</strong> en este turno.
                                    Cierra este modal y registra el arqueo primero.
                                </span>
                            </div>
                        )}

                        <div className="flex gap-4">
                            <div className="flex-1">
                                <Label>Turno</Label>
                                <Select
                                    value={formCierre.turno}
                                    onValueChange={(value) => setFormCierre((prev) => ({ ...prev, turno: value }))}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Selecciona turno" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="manana">🌅 Mañana</SelectItem>
                                        <SelectItem value="tarde">🌙 Tarde</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label>Monto Real Contado (S/)</Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    value={formCierre.monto_real}
                                    onChange={(e) => setFormCierre((prev) => ({ ...prev, monto_real: e.target.value }))}
                                    placeholder="Total en caja"
                                    required
                                />
                            </div>
                        </div>

                        <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg space-y-3">
                            <h4 className="font-semibold text-orange-800 flex items-center">
                                <Wallet className="w-4 h-4 mr-2" /> Distribución del Dinero Físico
                            </h4>
                            <div>
                                <Label className="text-orange-900">
                                    ¿Cuánto dinero dejará en caja para mañana? (S/)
                                </Label>
                                <Input
                                    type="number"
                                    step="0.01"
                                    min="0"
                                    // FIX #6 — max bind al estado actual (solo hint, validación real en handleCerrarCaja)
                                    max={formCierre.monto_real || 0}
                                    value={formCierre.fondo_reservado_proximo}
                                    onChange={(e) => setFormCierre((prev) => ({ ...prev, fondo_reservado_proximo: e.target.value }))}
                                    placeholder="Ej: 200.00"
                                />
                            </div>
                            {formCierre.monto_real && formCierre.fondo_reservado_proximo !== '' && (
                                <>
                                    {/* FIX #6 — Aviso visual si fondo supera el monto real */}
                                    {parseFloat(formCierre.fondo_reservado_proximo) > parseFloat(formCierre.monto_real) && (
                                        <p className="text-xs text-red-600">
                                            ⚠️ El fondo para mañana supera el monto real contado.
                                        </p>
                                    )}
                                    <div className="pt-2 border-t border-orange-200 flex justify-between text-orange-900 font-medium">
                                        <span>Retiro del Dueño (Utilidad):</span>
                                        <span className="text-lg">
                                            S/{' '}
                                            {(
                                                parseFloat(formCierre.monto_real) -
                                                parseFloat(formCierre.fondo_reservado_proximo || 0)
                                            ).toFixed(2)}
                                        </span>
                                    </div>
                                </>
                            )}
                        </div>

                        <div className="p-4 bg-gray-50 rounded-lg space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Saldo Esperado:</span>
                                <span className="font-semibold">{formatMonto(resumen?.resumen?.saldo_esperado)}</span>
                            </div>
                            {formCierre.monto_real && (
                                <div
                                    className={`flex justify-between p-2 rounded ${
                                        parseFloat(formCierre.monto_real) - (resumen?.resumen?.saldo_esperado || 0) < 0
                                            ? 'bg-red-50 text-red-700'
                                            : parseFloat(formCierre.monto_real) - (resumen?.resumen?.saldo_esperado || 0) > 0
                                            ? 'bg-green-50 text-green-700'
                                            : 'bg-blue-50 text-blue-700'
                                    }`}
                                >
                                    <span>Diferencia con sistema:</span>
                                    <span className="font-bold">
                                        {formatMonto(
                                            parseFloat(formCierre.monto_real) - (resumen?.resumen?.saldo_esperado || 0)
                                        )}
                                    </span>
                                </div>
                            )}
                        </div>

                        <div>
                            <Label>Observaciones (opcional)</Label>
                            <Input
                                value={formCierre.observaciones}
                                onChange={(e) => setFormCierre((prev) => ({ ...prev, observaciones: e.target.value }))}
                                placeholder="Ej: Faltante por cambio mal dado"
                            />
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setShowCierreModal(false)}>
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                className="bg-orange-600 hover:bg-orange-700"
                                disabled={cerrarCajaMutation.isPending || !huboArqueo}
                            >
                                {cerrarCajaMutation.isPending ? 'Cerrando...' : '🔒 Confirmar Cierre'}
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
// VISTA HISTORIAL
// ─────────────────────────────────────────────────────────────────────────────

const VistaHistorial = ({ onIrADashboard }) => {
    const queryClient = useQueryClient();
    const [showAperturaModal, setShowAperturaModal] = useState(false);

    const { data: historial = [], isLoading } = useQuery({
        queryKey: ['caja-historial'],
        queryFn: () => cajaService.getHistorialCajas(),
    });

    const hayCajaAbierta = historial.some((c) => c.estado === 'abierta');

    // FIX #4 — enabled con comparación estricta === false
    const { data: fondoSugerido, isLoading: fondoLoading } = useQuery({
        queryKey: ['caja-fondo-sugerido'],
        queryFn: () => cajaService.obtenerFondoSugerido(),
        enabled: hayCajaAbierta === false,
        staleTime: 0,
    });

    const abrirCajaMutation = useMutation({
        mutationFn: (data) => cajaService.abrirCaja(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['caja-historial'] });
            queryClient.invalidateQueries({ queryKey: ['caja-estado'] });
            // FIX #3 — Invalidar fondo sugerido al abrir nueva caja
            queryClient.invalidateQueries({ queryKey: ['caja-fondo-sugerido'] });
            setShowAperturaModal(false);
            Swal.fire({ icon: 'success', title: 'Turno Abierto', timer: 1500, showConfirmButton: false });
            onIrADashboard();
        },
        onError: (error) =>
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: error.response?.data?.error?.message || 'Error al abrir caja',
            }),
    });

    const handleExportarTurnosExcel = () => {
        if (!historial || historial.length === 0) {
            Swal.fire('Vacío', 'No hay turnos para exportar', 'info');
            return;
        }

        const cabeceras = [
            'Fecha Apertura',
            'Cajero',
            'Fondo Inicial (S/)',
            'Ventas (S/)',
            'Monto Real Final (S/)',
            'Estado',
            'Observaciones',
        ];
        const filas = historial.map((caja) => {
            // FIX #10 — Usar parseFecha
            const fecha = parseFecha(caja.created_at).toLocaleDateString('es-PE').replace(/,/g, '');
            const cajero = (caja.usuario_nombre || '-').replace(/,/g, '');
            const fondo = parseFloat(caja.monto_inicial || 0).toFixed(2);
            const ventas = parseFloat(caja.total_ventas || 0).toFixed(2);
            const real = parseFloat(caja.monto_final_real || 0).toFixed(2);
            const estado = caja.estado.toUpperCase();
            const obs = (caja.observaciones || '-').replace(/,/g, ' ');
            return `"${fecha}","${cajero}","${fondo}","${ventas}","${real}","${estado}","${obs}"`;
        });

        const csvContent = '\uFEFF' + cabeceras.join(',') + '\n' + filas.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Historial_Turnos_${new Date().getTime()}.csv`;
        link.click();
        URL.revokeObjectURL(url); // Liberar memoria
    };

    const handleVerReporte = (caja) => {
        const f = (val) => parseFloat(val || 0).toFixed(2);

        const fondo = f(caja.monto_inicial);
        const ventasGlobales = f(caja.total_ventas);
        const ventasEfectivo = f(caja.total_efectivo);
        const ventasTarjeta = f(caja.total_tarjeta);
        const ventasDigital = f(caja.total_otro);
        const ingresos = f(caja.total_ingresos);
        const egresos = f(parseFloat(caja.total_gastos || 0) + parseFloat(caja.total_retiros || 0));
        const esperadoFisico = f(caja.monto_final_esperado);
        // FIX #7 — Mostrar "-" en lugar de "0.00" si la caja aún está abierta
        const realFisico = caja.estado === 'cerrada' ? f(caja.monto_final_real) : null;
        const dif = parseFloat(caja.diferencia || 0);
        const fondoManana = f(caja.fondo_reservado_proximo);
        const retiroDueno = f(caja.monto_retirado_dueno);
        const turnoStr = String(caja.turno || 'N/A').toUpperCase();

        const colorDiferencia = dif < 0 ? '#ef4444' : dif > 0 ? '#10b981' : '#64748b';
        const textoDiferencia = dif < 0 ? '⚠️ FALTANTE' : dif > 0 ? '✓ SOBRANTE' : '✓ CUADRE PERFECTO';

        const htmlFormal = `
            <div style="font-family: 'Inter', system-ui, sans-serif; text-align: left; color: #334155; font-size: 13px; padding: 5px;">
                <div style="border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 12px;">
                    <h2 style="margin: 0; font-size: 18px; color: #0f172a; display: flex; justify-content: space-between; align-items: center;">
                        Turno ${turnoStr}
                        <span style="font-size: 11px; padding: 4px 10px; border-radius: 999px; font-weight: bold;
                            background: ${caja.estado === 'abierta' ? '#dcfce7' : '#f1f5f9'};
                            color: ${caja.estado === 'abierta' ? '#166534' : '#475569'};">
                            ${caja.estado.toUpperCase()}
                        </span>
                    </h2>
                    <p style="margin: 4px 0 0; color: #64748b;">Responsable: <strong>${caja.usuario_nombre}</strong></p>
                    <p style="margin: 2px 0 0; color: #64748b;">
                        Apertura: ${parseFecha(caja.created_at).toLocaleDateString('es-PE')}
                    </p>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 12px;">
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                        <h3 style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">📊 Ventas Totales</h3>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Efectivo:</span> <span style="font-weight: 500;">S/ ${ventasEfectivo}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Tarjeta:</span> <span style="font-weight: 500;">S/ ${ventasTarjeta}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;"><span>Digital:</span> <span style="font-weight: 500;">S/ ${ventasDigital}</span></div>
                        <div style="display: flex; justify-content: space-between; margin-top: 4px; font-weight: bold; color: #0f172a;"><span>Total:</span> <span>S/ ${ventasGlobales}</span></div>
                    </div>

                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 10px;">
                        <h3 style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">💰 Distribución</h3>
                        <div style="display: flex; justify-content: space-between; margin-bottom: 6px;"><span>Fondo próximo turno:</span> <span style="font-weight: 500;">S/ ${fondoManana}</span></div>
                        <div style="display: flex; justify-content: space-between; font-weight: bold; color: #0f172a;"><span>Retiro del Dueño:</span> <span>S/ ${retiroDueno}</span></div>
                    </div>
                </div>

                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px; margin-bottom: 12px;">
                    <h3 style="margin: 0 0 8px; font-size: 11px; color: #64748b; text-transform: uppercase;">💵 Control de Gaveta (Físico)</h3>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Fondo Inicial:</span> <span style="font-weight: 500;">S/ ${fondo}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>+ Ventas Efectivo:</span> <span style="color: #2563eb; font-weight: 500;">S/ ${ventasEfectivo}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>+ Ingresos Extras:</span> <span style="color: #16a34a; font-weight: 500;">S/ ${ingresos}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 8px; border-bottom: 1px dashed #cbd5e1; padding-bottom: 4px;"><span>- Egresos Extras:</span> <span style="color: #dc2626; font-weight: 500;">S/ ${egresos}</span></div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Saldo Esperado:</span> <span>S/ ${esperadoFisico}</span></div>
                    ${
                        /* FIX #7 — Solo mostrar real contado si la caja está cerrada */
                        realFisico !== null
                            ? `<div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                                <span>Real Contado:</span>
                                <span style="font-weight: bold; color: #0f172a;">S/ ${realFisico}</span>
                               </div>`
                            : `<div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #94a3b8;">
                                <span>Real Contado:</span>
                                <span>Turno aún activo</span>
                               </div>`
                    }
                    ${
                        caja.estado === 'cerrada'
                            ? `<div style="display: flex; justify-content: space-between; margin-top: 8px; padding-top: 8px; border-top: 1px solid #e2e8f0;">
                                <span style="font-weight: bold; color: #0f172a;">Diferencia:</span>
                                <span style="font-weight: bold; color: ${colorDiferencia};">${textoDiferencia} (S/ ${Math.abs(dif).toFixed(2)})</span>
                               </div>`
                            : ''
                    }
                </div>
                ${
                    caja.observaciones
                        ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 6px; padding: 10px; color: #92400e; font-size: 12px;">
                            <strong>Observaciones:</strong> ${caja.observaciones}
                           </div>`
                        : ''
                }
            </div>
        `;

        Swal.fire({
            html: htmlFormal,
            showCancelButton: true,
            confirmButtonText: 'Cerrar Panel',
            cancelButtonText: '🖨️ Imprimir Reporte',
            confirmButtonColor: '#f1f5f9',
            cancelButtonColor: '#3b82f6',
            reverseButtons: true,
            width: '520px',
            customClass: {
                confirmButton: '!text-slate-700 !font-semibold',
                cancelButton: '!font-semibold',
                htmlContainer: '!m-0 !p-0',
            },
        }).then((result) => {
            if (result.dismiss === Swal.DismissReason.cancel) {
                const ventanaImpresion = window.open('', '_blank', 'width=600,height=800');
                ventanaImpresion.document.write(`
                    <html>
                    <head>
                        <title>Imprimir Reporte</title>
                        <style>
                            * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
                            body { font-family: 'Inter', system-ui, sans-serif; margin: 0; padding: 20px; }
                            @media print { @page { margin: 10mm; } body { padding: 0; } }
                        </style>
                    </head>
                    <body>
                        ${htmlFormal}
                        <script>
                            setTimeout(() => {
                                window.print();
                                window.onafterprint = function() { window.close(); }
                            }, 300);
                        </script>
                    </body>
                    </html>
                `);
                ventanaImpresion.document.close();
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Gestión de Turnos</h1>
                    <p className="text-gray-500 mt-1">Control histórico de aperturas y cierres</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        className="text-emerald-600 border-emerald-200 hover:bg-emerald-50"
                        onClick={handleExportarTurnosExcel}
                    >
                        <Download className="h-4 w-4 mr-2" /> Exportar Excel
                    </Button>
                    <Button
                        onClick={() => (hayCajaAbierta ? onIrADashboard() : setShowAperturaModal(true))}
                        className={hayCajaAbierta ? 'bg-blue-600 hover:bg-blue-700' : 'bg-green-600 hover:bg-green-700'}
                    >
                        {hayCajaAbierta ? 'Ir al Turno Activo' : 'Abrir Nuevo Turno'}
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex justify-center py-12">
                            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                        </div>
                    ) : historial.length === 0 ? (
                        <p className="text-gray-500 text-center py-12">No hay turnos registrados aún</p>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-200 text-gray-700 uppercase font-bold">
                                <tr>
                                    <th className="px-8 py-4">Fecha Apertura</th>
                                    <th className="px-6 py-4">Cajero</th>
                                    <th className="px-6 py-4 text-right">Fondo Inicial</th>
                                    <th className="px-6 py-4 text-center">Estado</th>
                                    <th className="px-6 py-4 text-center">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {historial.map((caja) => (
                                    <tr key={caja.id} className="hover:bg-gray-50">
                                        {/* FIX #10 — Fecha con parseFecha */}
                                        <td className="px-6 py-4 font-medium">
                                            {parseFecha(caja.created_at).toLocaleDateString('es-PE')}
                                        </td>
                                        <td className="px-6 py-4">{caja.usuario_nombre}</td>
                                        <td className="px-6 py-4 text-right">
                                            S/ {parseFloat(caja.monto_inicial).toFixed(2)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Badge
                                                className={
                                                    caja.estado === 'abierta'
                                                        ? 'bg-emerald-100 text-emerald-700 border-none'
                                                        : 'bg-slate-100 text-slate-600 border-none'
                                                }
                                            >
                                                {caja.estado === 'abierta' ? '🟢 ABIERTA' : '🔴 CERRADA'}
                                            </Badge>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Button
                                                size="sm"
                                                variant={caja.estado === 'abierta' ? 'default' : 'outline'}
                                                onClick={() =>
                                                    caja.estado === 'abierta'
                                                        ? onIrADashboard()
                                                        : handleVerReporte(caja)
                                                }
                                            >
                                                {caja.estado === 'abierta' ? 'Gestionar' : 'Ver Reporte'}
                                            </Button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </CardContent>
            </Card>

            {/* ── MODAL: Abrir Nueva Caja ── */}
            <Dialog open={showAperturaModal} onOpenChange={setShowAperturaModal}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Unlock className="h-5 w-5 text-blue-600" /> Abrir Nueva Caja
                        </DialogTitle>
                    </DialogHeader>
                    <form
                        onSubmit={(e) => {
                            e.preventDefault();
                            const fd = new FormData(e.target);
                            abrirCajaMutation.mutate({
                                monto_inicial: parseFloat(fd.get('monto_inicial')),
                                observaciones: fd.get('observaciones'),
                            });
                        }}
                        className="space-y-4"
                    >
                        <p className="text-sm text-gray-600">
                            Registra el fondo inicial físico en la gaveta para comenzar las operaciones.
                        </p>
                        {fondoLoading ? (
                            <div className="flex justify-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                            </div>
                        ) : (
                            <>
                                <div>
                                    <Label htmlFor="monto_inicial">Fondo Inicial (S/)</Label>
                                    <Input
                                        name="monto_inicial"
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        defaultValue={fondoSugerido || ''}
                                        placeholder="0.00"
                                        required
                                        className="mt-1"
                                    />
                                    {fondoSugerido > 0 && (
                                        <p className="text-xs text-blue-600 mt-1">✓ Sugerido del cierre anterior</p>
                                    )}
                                </div>
                                <div>
                                    <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                                    <Input name="observaciones" placeholder="Ej: Turno mañana" className="mt-1" />
                                </div>
                                <DialogFooter>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => setShowAperturaModal(false)}
                                    >
                                        Cancelar
                                    </Button>
                                    <Button
                                        type="submit"
                                        className="bg-blue-600 hover:bg-blue-700"
                                        disabled={abrirCajaMutation.isPending}
                                    >
                                        {abrirCajaMutation.isPending ? 'Abriendo...' : 'Abrir Caja'}
                                    </Button>
                                </DialogFooter>
                            </>
                        )}
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
};
