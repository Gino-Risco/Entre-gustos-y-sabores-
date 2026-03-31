import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Navbar } from './Navbar';

export const DashboardLayout = () => {
  // Estado para controlar si el menú está abierto en el celular
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Overlay oscuro para móviles: si el menú está abierto, oscurece el fondo y al tocarlo se cierra */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 lg:hidden" 
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Le pasamos el estado al Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Contenedor principal: en pantallas grandes (lg) deja un margen a la izquierda de 64 (256px) */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Le pasamos la función al Navbar para que el botón de hamburguesa pueda abrir el menú */}
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
        
        {/* En móviles los márgenes son más pequeños (p-4), en PC más grandes (p-6) */}
        <main className="flex-1 p-4 lg:p-6 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
};