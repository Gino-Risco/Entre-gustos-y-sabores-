import { useQuery } from '@tanstack/react-query';
import { reportesService } from '@/services/reportes.service';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp, Users, Package, AlertTriangle, DollarSign, ChefHat, Clock, ListOrdered, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import VentasPorHoraChart from '@/components/dashboard/charts/VentasPorHoraChart';
import MetodosPagoChart from '@/components/dashboard/charts/MetodosPagoChart';
import TopProductosChart from '@/components/dashboard/charts/TopProductosChart';
// === HELPERS DE FORMATO ===
const formatearHora = (fechaISO) => {
  if (!fechaISO) return '';
  const fecha = new Date(fechaISO);
  return fecha.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
};

const obtenerEstadoLegible = (estado) => {
  const estados = {
    abierta: { texto: 'Tomando pedido', color: 'bg-blue-100 text-blue-800' },
    enviada_cocina: { texto: 'Enviado a cocina', color: 'bg-yellow-100 text-yellow-800' },
    preparando: { texto: 'Preparando', color: 'bg-orange-100 text-orange-800' },
    lista: { texto: 'Listo para servir', color: 'bg-green-100 text-green-800' }
  };
  return estados[estado] || { texto: estado, color: 'bg-gray-100 text-gray-800' };
};
export const Dashboard = () => {
  const { user } = useAuthStore();
  const isMesero = user?.rol === 'mesero';
  const hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });
  // 1. KPI Principal
  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportesService.getDashboard(),
    refetchInterval: 30000,
    staleTime: 0,
  });

  // 2. Queries para Gráficos (Admin/Cajero)
  const { data: ventasPorHora } = useQuery({
    queryKey: ['dashboard', 'ventas-hora', hoy],
    queryFn: () => reportesService.getVentasPorHora(hoy),
    enabled: !isMesero,
    staleTime: 5 * 60 * 1000,
  });

  const { data: metodosPago } = useQuery({
    queryKey: ['dashboard', 'metodos-pago', hoy],
    queryFn: () => reportesService.getMetodosPago(hoy),
    enabled: !isMesero,
    staleTime: 5 * 60 * 1000,
  });

  const { data: topProductos } = useQuery({
    queryKey: ['dashboard', 'top-productos', hoy],
    queryFn: () => reportesService.getTopProductos(hoy),
    staleTime: 5 * 60 * 1000,
  });

  const { data: ordenesActivas } = useQuery({
    queryKey: ['dashboard', 'ordenes-activas'],
    queryFn: () => reportesService.getOrdenesActivas(5),
    refetchInterval: 15000,
    staleTime: 10000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalIngresos = parseFloat(dashboard?.ventas?.total_ingresos) || 0;
  const ordenesCount = parseInt(dashboard?.ordenes_activas) || 0;
  const stockBajo = parseInt(dashboard?.stock_bajo) || 0;
  const comparacionVentas = dashboard?.comparacion_ventas || 'igual';

  // Filtramos stats según rol
  const allStats = [
    { title: 'Mesas Ocupadas', value: ordenesCount, description: 'Actualmente', icon: Users, gradient: 'from-blue-500 to-blue-600', roles: ['administrador', 'cajero', 'mesero'] },
    { title: 'Pedidos Activos', value: ordenesCount, description: 'En preparación', icon: ChefHat, gradient: 'from-green-500 to-green-600', roles: ['administrador', 'cajero', 'mesero'] },
    {
      title: 'Ventas del Día',
      value: `S/ ${totalIngresos.toFixed(2)}`,
      description: 'Total cobrado', icon: DollarSign,
      gradient: 'from-purple-500 to-purple-600',
      roles: ['administrador', 'cajero'],
      comparacion: comparacionVentas
    },
    // === NUEVA TARJETA: TICKET PROMEDIO ===
    {
      title: 'Ticket Promedio',
      // Usamos el dato que ya viene del backend y lo formateamos a 2 decimales
      value: `S/ ${parseFloat(dashboard?.ventas?.ticket_promedio || 0).toFixed(2)}`,
      description: 'Gasto por orden',
      icon: TrendingUp, // El icono de crecimiento
      gradient: 'from-emerald-500 to-teal-600', // Un verde esmeralda elegante
      roles: ['administrador', 'cajero']
    },
  ];
  const statsVisibles = allStats.filter(stat => stat.roles.includes(user?.rol));

  return (
    <div className="space-y-6 p-4 md:p-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900">
          {isMesero ? `Hola, ${user?.nombre?.split(' ')[0]}!` : 'Panel de Control'}
        </h1>
        <p className="text-sm text-gray-500">
          {isMesero ? 'Resumen de tu servicio actual' : `Resumen del sistema - ${hoy}`}
        </p>
      </div>

      {/* 1. ALERTA DE STOCK (Solo si hay problemas reales) */}
      {stockBajo > 0 && !isMesero && (
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 flex items-start gap-4 animate-in fade-in slide-in-from-top-2">
          <div className="p-2 bg-red-100 rounded-full text-red-600 mt-1">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-red-800">¡Atención Requerida!</h3>
            <p className="text-sm text-red-700 mt-1">
              Hay <strong>{stockBajo} productos</strong> con stock bajo o agotado.
              <a href="/inventario/alertas" className="underline font-medium hover:text-red-900 ml-1">Ver detalles →</a>
            </p>
          </div>
        </div>
      )}

      {/* 2. KPIs GRID */}
      <div className={`grid gap-4 md:grid-cols-2 ${isMesero ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
        {statsVisibles.map((stat, index) => (
          <Card key={index} className="bg-white shadow-md border border-gray-200 overflow-hidden">            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{stat.title}</CardTitle>
            <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient} text-white shadow-sm`}>
              <stat.icon className="h-4 w-4" />
            </div>
          </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              {stat.comparacion ? (
                <div className="mt-2 flex items-center gap-2">
                  <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${stat.comparacion.tendencia === 'sube' ? 'bg-green-100 text-green-700' :
                    stat.comparacion.tendencia === 'baja' ? 'bg-red-100 text-red-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                    {stat.comparacion.tendencia === 'sube' ? '↑' : stat.comparacion.tendencia === 'baja' ? '↓' : '-'} {stat.comparacion.texto}
                  </span>
                  <span className="text-xs text-gray-400">{stat.description}</span>
                </div>
              ) : (
                <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                  {stat.description}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 3. SECCIÓN INFERIOR (Solo Admin/Cajero) */}
      {!isMesero && (
        <div className="space-y-6">
          {/* Fila A: Gráficos con Contexto */}
          <div className="grid gap-6 md:grid-cols-2">

            {/* Ventas por Hora */}
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex justify-between items-center">
                  <span>💰 Tendencia de Ventas</span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Hoy</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Resumen rápido encima del gráfico */}
                <div className="flex items-baseline gap-2 mb-4">
                  <span className="text-2xl font-bold text-gray-900">S/ {totalIngresos.toFixed(2)}</span>
                  <span className="text-sm text-gray-500">ingresados hoy</span>
                </div>
                <VentasPorHoraChart data={ventasPorHora} />
              </CardContent>
            </Card>

            {/* Métodos de Pago */}
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex justify-between items-center">
                  <span>💳 Métodos de Pago</span>
                  <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-1 rounded">Distribución</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center">
                <div className="w-full h-64">
                  <MetodosPagoChart data={metodosPago} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Fila B: Operatividad (Distribución 50/50) */}
          <div className="grid gap-6 md:grid-cols-2">

            {/* Top Productos */}
            <Card className="shadow-sm border-0">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  🏆 Top 5 Productos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* El gráfico ahora tendrá el 50% del ancho de la pantalla, se verá mucho mejor */}
                <TopProductosChart data={topProductos} />
              </CardContent>
            </Card>

            {/* Órdenes Activas */}
            <Card className="shadow-sm border-0 md:col-span-1">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-base font-medium flex items-center gap-2">
                  <ListOrdered className="h-5 w-5 text-blue-600" /> Órdenes en Curso
                </CardTitle>
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                  {ordenesActivas?.length || 0} activas
                </span>
              </CardHeader>
              <CardContent className="max-h-80 overflow-y-auto pr-1">
                {ordenesActivas?.length > 0 ? (
                  <div className="space-y-3">
                    {ordenesActivas.map((orden) => {
                      const estadoInfo = obtenerEstadoLegible(orden.estado);
                      return (
                        <div key={orden.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white border border-gray-100 rounded-lg hover:border-blue-200 transition shadow-sm gap-2">

                          {/* Izquierda: Identificador (Mesa o Llevar) y Comanda */}

                          <div className="flex items-center gap-3">
                            {orden.mesa ? (
                              <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center text-blue-700 font-bold text-sm shrink-0">
                                M{orden.mesa}
                              </div>
                            ) : (
                              <div className="h-10 w-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-700 font-bold text-sm shrink-0" title="Para Llevar">
                                <Package className="h-5 w-5" />
                              </div>
                            )}

                            <div>
                              <p className="font-semibold text-gray-900 text-sm leading-tight flex items-center gap-2">
                                {orden.comanda}
                                {/* Si es para llevar y hay cliente, mostramos el nombre en un badge */}
                                {!orden.mesa && orden.cliente && (
                                  <span className="text-xs font-normal bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                                    {orden.cliente}
                                  </span>
                                )}
                              </p>
                              <p className="text-xs text-gray-500">
                                {orden.mesero} • <span className="text-blue-600 font-medium">{formatearHora(orden.hora)}</span>
                              </p>
                            </div>
                          </div>

                          {/* Derecha: Total y Estado */}
                          <div className="flex items-center gap-4 pl-13 sm:pl-0">
                            <p className="text-sm font-bold text-gray-900 whitespace-nowrap">
                              S/ {orden.total.toFixed(2)}
                            </p>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${estadoInfo.color}`}>
                              {estadoInfo.texto}
                            </span>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <ChefHat className="h-10 w-10 mb-2 opacity-20" />
                    <p className="text-sm">No hay órdenes activas. ¡Todo al día!</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Vista Mesero (Simplificada) */}
      {isMesero && (
        <div className="grid gap-6 md:grid-cols-2">
          <Card className="shadow-sm border-0 bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition" onClick={() => window.location.href = '/mesas'}>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Users className="h-12 w-12 mb-4 opacity-80" />
              <h3 className="text-xl font-bold">Ir a Gestión de Mesas</h3>
              <p className="text-blue-200 text-sm mt-1">Tomar pedidos y ver estado</p>
            </CardContent>
          </Card>
          <Card className="shadow-sm border-0">
            <CardHeader><CardTitle className="text-base">Estado de Cocina</CardTitle></CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 text-gray-500">
              <p className="text-sm">No tienes platos listos para recoger.</p>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};