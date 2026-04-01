import { useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  UtensilsCrossed,
  ShoppingBag,
  Receipt,
  Package,
  LogOut,
  ChefHat,
  Database,
  BarChart3,
  TrendingUp,
  Truck,
  Users,
  AlertTriangle,
  History,
  ChevronDown,
  ChevronRight,
  Utensils
} from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { cn } from '@/lib/utils';

// Menú principal (Colores ajustados a 400 para que resalten en el fondo oscuro)
const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-blue-400'
  },
  {
    title: 'Mesas',
    icon: UtensilsCrossed,
    path: '/mesas',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-green-400'
  },
  {
    title: 'Pedidos',
    icon: Receipt,
    path: '/pedidos',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-purple-400'
  },
  {
    title: 'Ventas',
    icon: ShoppingBag,
    path: '/ventas',
    roles: ['administrador', 'cajero'],
    color: 'text-pink-400'
  },
  {
    title: 'Cocina',
    icon: ChefHat,
    path: '/cocina',
    roles: ['administrador', 'mesero'],
    color: 'text-orange-400'
  },
  {
    title: 'Categorías',
    icon: Database,
    path: '/categorias',
    roles: ['administrador'],
    color: 'text-indigo-400'
  },
  {
    title: 'Caja',
    icon: Receipt,
    path: '/caja',
    roles: ['administrador', 'cajero'],
    color: 'text-emerald-400'
  },
  {
    title: 'Reportes',
    icon: BarChart3,
    path: '/reportes',
    roles: ['administrador'],
    color: 'text-red-400'
  },
  {
    title: 'Usuarios',
    icon: Users,
    path: '/usuarios',
    roles: ['administrador'],
    color: 'text-indigo-400'
  }
];

const productosSubMenu = [
  {
    title: 'Carta / Platos',
    icon: Utensils,
    path: '/productos/carta',
    roles: ['administrador'],
    color: 'text-cyan-400'
  },
  {
    title: 'Almacén / Insumos',
    icon: Package,
    path: '/productos/almacen',
    roles: ['administrador'],
    color: 'text-blue-400'
  }
];

const inventarioSubMenu = [
  {
    title: 'Compras',
    icon: Truck,
    path: '/inventario/compras',
    roles: ['administrador'],
    color: 'text-blue-400'
  },
  {
    title: 'Proveedores',
    icon: Users,
    path: '/inventario/proveedores',
    roles: ['administrador'],
    color: 'text-green-400'
  },
  {
    title: 'Salidas Cocina',
    icon: ChefHat,
    path: '/inventario/salidas-cocina',
    roles: ['administrador'],
    color: 'text-orange-400'
  },
  {
    title: 'Alertas de Stock',
    icon: AlertTriangle,
    path: '/inventario/alertas',
    roles: ['administrador', 'cocinero'],
    color: 'text-red-400'
  },
  {
    title: 'Kardex',
    icon: History,
    path: '/inventario/kardex',
    roles: ['administrador'],
    color: 'text-purple-400'
  },
];

export const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();

  const [isProductosOpen, setIsProductosOpen] = useState(false);
  const [isInventarioOpen, setIsInventarioOpen] = useState(false);

  const canAccessMenu = (roles) => {
    if (!user) return false;
    return roles.includes(user.rol);
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLinkClick = () => {
    if (setIsOpen) setIsOpen(false);
  };

  const isProductosActive = productosSubMenu.some(item => location.pathname === item.path);
  const isInventarioActive = inventarioSubMenu.some(item => location.pathname === item.path);

return (
    <aside
      className={cn(
        // FONDO AZUL NOCHE SUAVE (slate-800) Y BORDE (slate-700)
        "fixed left-0 top-0 z-40 h-screen w-64 bg-slate-800 border-r border-slate-700 transition-transform duration-300 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo Section */}
        <div className="h-20 flex items-center gap-3 px-6 border-b border-slate-700 shrink-0">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">POS</span>
          </div>
          <div>
            <h1 className="text-white font-bold text-sm leading-tight">Entre gustos y sabores</h1>
            <p className="text-xs text-slate-400 font-medium">v1.0.0</p>
          </div>
        </div>

        {/* Navigation Section */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            if (!canAccessMenu(item.roles)) return null;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleLinkClick}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                  )
                }
              >
                <item.icon className={cn('h-5 w-5', isActive ? 'text-white' : item.color)} />
                {item.title}
              </NavLink>
            );
          })}

          {/* ACCORDION: Productos */}
          {canAccessMenu(['administrador']) && (
            <div className="space-y-1">
              <button
                onClick={() => setIsProductosOpen(!isProductosOpen)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  isProductosActive || isProductosOpen
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <Package className={cn('h-5 w-5', isProductosActive || isProductosOpen ? 'text-cyan-400' : 'text-slate-400')} />
                  <span>Productos</span>
                </div>
                {isProductosOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {isProductosOpen && (
                <div className="ml-4 pl-4 border-l-2 border-slate-600 space-y-1 mt-1">
                  {productosSubMenu.map((item) => {
                    if (!canAccessMenu(item.roles)) return null;
                    const isActive = location.pathname === item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleLinkClick}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                            isActive ? 'bg-slate-700 text-cyan-400' : 'text-slate-400 hover:text-white'
                          )
                        }
                      >
                        <item.icon className={cn('h-4 w-4', isActive ? 'text-cyan-400' : item.color)} />
                        {item.title}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ACCORDION: Inventario */}
          {canAccessMenu(['administrador']) && (
            <div className="space-y-1">
              <button
                onClick={() => setIsInventarioOpen(!isInventarioOpen)}
                className={cn(
                  'w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                  isInventarioActive || isInventarioOpen
                    ? 'bg-slate-700 text-white'
                    : 'text-slate-300 hover:bg-slate-700 hover:text-white'
                )}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className={cn('h-5 w-5', isInventarioActive || isInventarioOpen ? 'text-indigo-400' : 'text-slate-400')} />
                  <span>Inventario</span>
                </div>
                {isInventarioOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {isInventarioOpen && (
                <div className="ml-4 pl-4 border-l-2 border-slate-600 space-y-1 mt-1">
                  {inventarioSubMenu.map((item) => {
                    if (!canAccessMenu(item.roles)) return null;
                    const isActive = location.pathname === item.path;
                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleLinkClick}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                            isActive ? 'bg-slate-700 text-indigo-400' : 'text-slate-400 hover:text-white'
                          )
                        }
                      >
                        <item.icon className={cn('h-4 w-4', isActive ? 'text-indigo-400' : item.color)} />
                        {item.title}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Logout Section */}
        <div className="p-3 border-t border-slate-700 shrink-0 bg-slate-800">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-500/10 transition-colors duration-200"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </aside>
  );
};