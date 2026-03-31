import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import { Login } from '@/pages/Login';
import { Dashboard } from '@/pages/Dashboard';
import { Mesas } from '@/pages/Mesas';
import { Pedidos } from '@/pages/Pedidos';
import { ProductoForm } from '@/pages/productos/ProductoForm';
import { Categorias } from '@/pages/Categorias';
import { Ventas } from '@/pages/Ventas';
import { Caja } from '@/pages/Caja';
import { Compras } from '@/pages/inventario/Compras';
import { CompraCrear } from '@/pages/inventario/CompraCrear';
import { CompraDetalle } from '@/pages/inventario/CompraDetalle';
import { Proveedores } from '@/pages/inventario/Proveedores';
import { SalidasCocina } from '@/pages/inventario/SalidasCocina';
import { AlertasStock } from '@/pages/inventario/AlertasStock';
import { Kardex } from '@/pages/inventario/Kardex';
import { Carta } from '@/pages/productos/Carta';
import { Almacen } from '@/pages/productos/Almacen';
import { Usuarios } from '@/pages/usuarios/Usuarios';
import { NotFound } from '@/pages/NotFound';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    // El DashboardLayout base requiere estar logueado
    element: (
      <ProtectedRoute>
        <DashboardLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        path: '/dashboard',
        element: <Dashboard />
      },

      // ==========================================
      // 🍽️ ZONA PÚBLICA (Admin, Cajero, Mesero)
      // ==========================================
      {
        path: '/mesas',
        element: <ProtectedRoute allowedRoles={['administrador', 'cajero', 'mesero']}><Mesas /></ProtectedRoute>
      },
      {
        path: '/pedidos',
        element: <ProtectedRoute allowedRoles={['administrador', 'cajero', 'mesero']}><Pedidos /></ProtectedRoute>
      },

      // ==========================================
      // 💵 ZONA DE CAJA Y VENTAS (Admin, Cajero)
      // ==========================================
      {
        path: '/caja',
        element: <ProtectedRoute allowedRoles={['administrador', 'cajero']}><Caja /></ProtectedRoute>
      },
      {
        path: '/ventas',
        element: <ProtectedRoute allowedRoles={['administrador', 'cajero']}><Ventas /></ProtectedRoute>
      },

      // ==========================================
      // 🔐 ZONA RESTRINGIDA (Solo Administrador)
      // ==========================================
      {
        path: '/usuarios',
        element: <ProtectedRoute allowedRoles={['administrador']}><Usuarios /></ProtectedRoute>
      },
      {
        path: '/categorias',
        element: <ProtectedRoute allowedRoles={['administrador']}><Categorias /></ProtectedRoute>
      },

      // --- SECCIÓN PRODUCTOS ---
      {
        path: '/productos/carta',
        element: <ProtectedRoute allowedRoles={['administrador']}><Carta /></ProtectedRoute>
      },
      {
        path: '/productos/carta/crear',
        element: <ProtectedRoute allowedRoles={['administrador']}><ProductoForm modo="carta" /></ProtectedRoute>
      },
      {
        path: '/productos/almacen',
        element: <ProtectedRoute allowedRoles={['administrador']}><Almacen /></ProtectedRoute>
      },
      {
        path: '/productos/almacen/crear',
        element: <ProtectedRoute allowedRoles={['administrador']}><ProductoForm modo="almacen" /></ProtectedRoute>
      },
      {
        path: '/productos/editar/:id',
        element: <ProtectedRoute allowedRoles={['administrador']}><ProductoForm /></ProtectedRoute>
      },

      // --- INVENTARIO  ---
      {
        path: '/inventario/compras',
        element: <ProtectedRoute allowedRoles={['administrador']}><Compras /></ProtectedRoute>
      },
      {
        path: '/inventario/compras/crear',
        element: <ProtectedRoute allowedRoles={['administrador']}><CompraCrear /></ProtectedRoute>
      },
      {
        path: '/inventario/compras/:id',
        element: <ProtectedRoute allowedRoles={['administrador']}><CompraDetalle /></ProtectedRoute>
      },
      {
        path: '/inventario/proveedores',
        element: <ProtectedRoute allowedRoles={['administrador']}><Proveedores /></ProtectedRoute>
      },
      {
        path: '/inventario/salidas-cocina',
        element: <ProtectedRoute allowedRoles={['administrador']}><SalidasCocina /></ProtectedRoute>
      },
      {
        path: '/inventario/alertas',
        element: <ProtectedRoute allowedRoles={['administrador', 'cocinero']}><AlertasStock /></ProtectedRoute>
      },
      {
        path: '/inventario/kardex',
        element: <ProtectedRoute allowedRoles={['administrador']}><Kardex /></ProtectedRoute>
      },

      // Redirección inicial
      {
        path: '/',
        element: <Navigate to="/dashboard" replace />,
      },
    ],
  },

  // RUTA DE NO AUTORIZADO
  {
    path: '/unauthorized',
    element: (
      <div className="flex flex-col items-center justify-center h-screen bg-gray-50 text-center px-4">
        <h1 className="text-6xl font-bold text-red-600 mb-4">403</h1>
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Acceso Denegado</h2>
        <p className="text-gray-500 mb-6">Tu rol no tiene permisos para ver esta página.</p>
        <a href="/dashboard" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Volver al Inicio</a>
      </div>
    ),
  },
  {
    path: '*',
    element: <NotFound />,
  },
]);