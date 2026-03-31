import { useQuery } from '@tanstack/react-query';
import { reportesService } from '@/services/reportes.service';
import { useAuthStore } from '@/store/auth.store';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp,
  Users,
  Package,
  AlertTriangle,
  DollarSign,
  ShoppingBag,
  ChefHat,
  Clock,
  Utensils
} from 'lucide-react';

export const Dashboard = () => {
  const { user } = useAuthStore(); // Obtenemos el usuario logueado
  const isMesero = user?.rol === 'mesero';

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => reportesService.getDashboard(),
    refetchInterval: 5000, // Lo mantenemos actualizado cada 5s
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const totalIngresos = parseFloat(dashboard?.ventas?.total_ingresos) || 0;
  const ordenesActivas = parseInt(dashboard?.ordenes_activas) || 0;
  const stockBajo = parseInt(dashboard?.stock_bajo) || 0;
  const alertasPendientes = parseInt(dashboard?.alertas_pendientes) || 0;

  // Definimos todas las posibles stats
  const allStats = [
    {
      title: 'Mesas Ocupadas',
      value: ordenesActivas,
      description: 'Actualmente',
      icon: Users,
      gradient: 'from-blue-500 to-blue-600',
      roles: ['administrador', 'cajero', 'mesero'] // Todos lo ven
    },
    {
      title: 'Pedidos Activos',
      value: ordenesActivas,
      description: 'En preparación',
      icon: ChefHat,
      gradient: 'from-green-500 to-green-600',
      roles: ['administrador', 'cajero', 'mesero'] // Todos lo ven
    },
    {
      title: 'Ventas del Día',
      value: `S/ ${totalIngresos.toFixed(2)}`,
      description: 'Total cobrado',
      icon: DollarSign,
      gradient: 'from-purple-500 to-purple-600',
      roles: ['administrador', 'cajero'] // Mesero NO lo ve
    },
    {
      title: 'Stock Bajo',
      value: stockBajo,
      description: 'Productos por reponer',
      icon: Package,
      gradient: 'from-orange-500 to-orange-600',
      roles: ['administrador'] // Solo Admin lo ve
    },
  ];

  // Filtramos las stats según el rol del usuario
  const statsVisibles = allStats.filter(stat => stat.roles.includes(user?.rol));

  return (
    <div className="space-y-6">
      {/* Header Dinámico */}
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-bold text-gray-900">
          {isMesero ? `¡Hola, ${user?.nombre?.split(' ')[0]}!` : 'Dashboard'}
        </h1>
        <p className="text-gray-500 italic">
          {isMesero
            ? 'Panel de control de servicio'
            : 'Resumen general del sistema'}
        </p>
      </div>

      {/* Stats Grid - Se ajusta según las tarjetas visibles */}
      <div className={`grid gap-6 md:grid-cols-2 ${isMesero ? 'lg:grid-cols-2' : 'lg:grid-cols-4'}`}>
        {statsVisibles.map((stat, index) => (
          <Card key={index} className="relative overflow-hidden border-0 shadow-lg transition-transform hover:scale-[1.02]">
            <div className={`absolute top-0 right-0 h-24 w-24 bg-gradient-to-br ${stat.gradient} opacity-10 rounded-bl-full`} />
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">
                {stat.title}
              </CardTitle>
              <div className={`p-2 rounded-lg bg-gradient-to-br ${stat.gradient}`}>
                <stat.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">
                {stat.value}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Banner de Alertas - Solo para Admin/Cajero */}
      {!isMesero && (alertasPendientes > 0 || stockBajo > 0) && (
        <div className="rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white shadow-lg animate-pulse">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-white/20 rounded-lg">
              <AlertTriangle className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-white">¡Atención Administrador!</h3>
              <p className="text-blue-100">
                Hay {stockBajo} productos que necesitan reposición inmediata.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Sección Inferior Personalizada */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isMesero ? (
          // VISTA MOZO: Acciones de servicio
          <>
            <Card
              className="border-0 shadow-lg bg-blue-600 text-white cursor-pointer hover:bg-blue-700"
              onClick={() => window.location.href = '/mesas'}
            >
              <CardHeader className="flex flex-row items-center gap-4">
                <Utensils className="h-8 w-8 text-blue-200" />
                <CardTitle className="text-white">Ir a Mesas</CardTitle>
              </CardHeader>
            </Card>

            <Card className="border-0 shadow-lg lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500 uppercase">Estado de Cocina</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">No tienes platos listos para recoger en este momento.</p>
              </CardContent>
            </Card>
          </>
        ) : (
          // VISTA ADMIN: Reportes (Lo que ya tenías)
          <>
            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>

                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Clock className="h-5 w-5 text-green-600" />
                  Órdenes Pendientes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500">No hay órdenes pendientes</p>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <TrendingUp className="h-5 w-5 text-purple-600" />
                  Productos Más Vendidos
                </CardTitle>

              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 italic">Cargando datos ...</p>
              </CardContent>
            </Card>
            {/* ... Resto de tus cartas de admin ... */}
          </>
        )}
      </div>
    </div>
  );
};