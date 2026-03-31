import { Bell, Search, Settings, User, Menu } from 'lucide-react'; // 👈 Añadimos Menu
import { useAuthStore } from '@/store/auth.store';

// 👇 Recibimos la función onMenuClick como prop 👇
export const Navbar = ({ onMenuClick }) => {
  const { user } = useAuthStore();
  const currentDate = new Date().toLocaleDateString('es-ES', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-gray-200 bg-white px-4 md:px-6 shadow-sm">
      
      {/* Sección Izquierda: Botón Hamburguesa + Títulos */}
      <div className="flex items-center gap-3 flex-1">
        
        {/* 👇 BOTÓN HAMBURGUESA: Solo visible en pantallas pequeñas (lg:hidden) 👇 */}
        <button 
          onClick={onMenuClick}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 text-gray-600 lg:hidden transition-colors"
        >
          <Menu className="h-6 w-6" />
        </button>

        <div>
          <h2 className="text-lg font-semibold text-gray-900 line-clamp-1">Panel de Control</h2>
          <p className="text-xs text-gray-500 capitalize">{currentDate}</p>
        </div>
      </div>

      {/* Sección Derecha: Opciones y Perfil */}
      <div className="flex items-center gap-2 md:gap-4">
        
        <div className="hidden md:flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg">
          <Search className="h-4 w-4 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar..."
            className="bg-transparent border-none outline-none text-sm text-gray-700 placeholder-gray-500 w-48"
          />
        </div>

        <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Bell className="h-5 w-5 text-gray-600" />
          <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full"></span>
        </button>

        <button className="hidden sm:block p-2 rounded-lg hover:bg-gray-100 transition-colors">
          <Settings className="h-5 w-5 text-gray-600" />
        </button>

        <div className="flex items-center gap-2 p-1 md:p-2 rounded-lg">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center shrink-0">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="hidden md:block text-left">
            <p className="text-sm font-medium text-gray-900">{user?.nombre}</p>
            <p className="text-xs text-gray-500 capitalize">{user?.rol}</p>
          </div>
        </div>
        
      </div>
    </header>
  );
};