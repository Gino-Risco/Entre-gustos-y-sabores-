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

// Menú principal 
const menuItems = [
  {
    title: 'Dashboard',
    icon: LayoutDashboard,
    path: '/dashboard',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-blue-600'
  },
  {
    title: 'Mesas',
    icon: UtensilsCrossed,
    path: '/mesas',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-green-600'
  },
  {
    title: 'Pedidos',
    icon: Receipt,
    path: '/pedidos',
    roles: ['administrador', 'cajero', 'mesero'],
    color: 'text-purple-600'
  },
  {
    title: 'Ventas',
    icon: ShoppingBag,
    path: '/ventas',
    roles: ['administrador', 'cajero'],
    color: 'text-pink-600'
  },
  {
    title: 'Cocina',
    icon: ChefHat,
    path: '/cocina',
    roles: ['administrador', 'mesero'],
    color: 'text-orange-600'
  },
  {
    title: 'Categorías',
    icon: Database,
    path: '/categorias',
    roles: ['administrador'],
    color: 'text-indigo-600'
  },
  {
    title: 'Caja',
    icon: Receipt,
    path: '/caja',
    roles: ['administrador', 'cajero'],
    color: 'text-emerald-600'
  },
  {
    title: 'Reportes',
    icon: BarChart3,
    path: '/reportes',
    roles: ['administrador'],
    color: 'text-red-600'
  },
  {
    title: 'Usuarios',
    icon: Users,
    path: '/usuarios',
    roles: ['administrador'],
    color: 'text-indigo-600'
  }
];

const productosSubMenu = [
  {
    title: 'Carta / Platos',
    icon: Utensils,
    path: '/productos/carta',
    roles: ['administrador'],
    color: 'text-cyan-600'
  },
  {
    title: 'Almacén / Insumos',
    icon: Package,
    path: '/productos/almacen',
    roles: ['administrador'],
    color: 'text-blue-600'
  }
];

const inventarioSubMenu = [
  {
    title: 'Compras',
    icon: Truck,
    path: '/inventario/compras',
    roles: ['administrador'],
    color: 'text-blue-600'
  },
  {
    title: 'Proveedores',
    icon: Users,
    path: '/inventario/proveedores',
    roles: ['administrador'],
    color: 'text-green-600'
  },
  {
    title: 'Salidas Cocina',
    icon: ChefHat,
    path: '/inventario/salidas-cocina',
    roles: ['administrador'],
    color: 'text-orange-600'
  },
  {
    title: 'Alertas de Stock',
    icon: AlertTriangle,
    path: '/inventario/alertas',
    roles: ['administrador', 'cocinero'],
    color: 'text-red-600'
  },
  {
    title: 'Kardex',
    icon: History,
    path: '/inventario/kardex',
    roles: ['administrador'],
    color: 'text-purple-600'
  },
];

// 👇 RECIBIMOS LOS PROPS PARA CONTROLAR EL ESTADO EN MÓVILES 👇
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

  // 👇 Función para cerrar el menú en móviles al hacer clic en un enlace 👇
  const handleLinkClick = () => {
    if (setIsOpen) setIsOpen(false);
  };

  const isProductosActive = productosSubMenu.some(item => location.pathname === item.path);
  const isInventarioActive = inventarioSubMenu.some(item => location.pathname === item.path);

  return (
    <aside 
      // 👇 MAGIA RESPONSIVA DE TAILWIND 👇
      className={cn(
        "fixed left-0 top-0 z-40 h-screen w-64 bg-white border-r border-gray-200 transition-transform duration-300 ease-in-out lg:translate-x-0",
        isOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"
      )}
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <div className="h-16 flex items-center gap-3 px-6 border-b border-gray-200 shrink-0">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-lg">POS</span>
          </div>
          <div>
            <h1 className="text-gray-900 font-bold text-sm leading-tight">Entre gustos y sabores</h1>
            <p className="text-xs text-gray-500">v1.0.0</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => {
            if (!canAccessMenu(item.roles)) return null;
            const isActive = location.pathname === item.path;

            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={handleLinkClick} // <-- Cerramos al hacer clic
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200',
                    isActive
                      ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg shadow-blue-500/30'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
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
                    ? 'bg-gradient-to-r from-cyan-500 to-cyan-600 text-white shadow-lg shadow-cyan-500/30'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <Package className={cn('h-5 w-5', isProductosActive || isProductosOpen ? 'text-white' : 'text-cyan-600')} />
                  <span>Productos</span>
                </div>
                {isProductosOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {isProductosOpen && (
                <div className="ml-4 pl-4 border-l-2 border-cyan-300 space-y-1">
                  {productosSubMenu.map((item) => {
                    if (!canAccessMenu(item.roles)) return null;
                    const isActive = location.pathname === item.path;

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleLinkClick} // <-- Cerramos al hacer clic
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                            isActive
                              ? 'bg-cyan-100 text-cyan-700'
                              : 'text-gray-600 hover:bg-cyan-50 hover:text-cyan-600'
                          )
                        }
                      >
                        <item.icon className={cn('h-4 w-4', isActive ? 'text-cyan-600' : item.color)} />
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
                    ? 'bg-gradient-to-r from-indigo-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/30'
                    : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                )}
              >
                <div className="flex items-center gap-3">
                  <TrendingUp className={cn('h-5 w-5', isInventarioActive || isInventarioOpen ? 'text-white' : 'text-indigo-600')} />
                  <span>Inventario</span>
                </div>
                {isInventarioOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>

              {isInventarioOpen && (
                <div className="ml-4 pl-4 border-l-2 border-indigo-300 space-y-1">
                  {inventarioSubMenu.map((item) => {
                    if (!canAccessMenu(item.roles)) return null;
                    const isActive = location.pathname === item.path;

                    return (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        onClick={handleLinkClick} // <-- Cerramos al hacer clic
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-3 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200',
                            isActive
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'text-gray-600 hover:bg-indigo-50 hover:text-indigo-600'
                          )
                        }
                      >
                        <item.icon className={cn('h-4 w-4', isActive ? 'text-indigo-600' : item.color)} />
                        {item.title}
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Logout */}
        <div className="p-3 border-t border-gray-200 shrink-0">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors duration-200"
          >
            <LogOut className="h-5 w-5" />
            Cerrar Sesión
          </button>
        </div>
      </div>
    </aside>
  );
};