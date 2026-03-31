import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Utensils, Users, MapPin, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { mesasService } from '@/services/mesas.service';
import { ordenesService } from '@/services/ordenes.service';
import { MesaCard } from '@/components/mesas/MesaCard';
import { MesaStatus, statusConfig } from '@/components/mesas/MesaStatus';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
// 👇 IMPORTAMOS EL STORE DE AUTENTICACIÓN 👇
import { useAuthStore } from '@/store/auth.store';

export const Mesas = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // 👇 EXTRAEMOS AL USUARIO LOGUEADO 👇
  const { user } = useAuthStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEstado, setFilterEstado] = useState('todos');
  const [formOpen, setFormOpen] = useState(false);
  const [detalleOpen, setDetalleOpen] = useState(false);
  const [selectedMesa, setSelectedMesa] = useState(null);
  const [editMode, setEditMode] = useState(false);

  // Fetch mesas
  const { data: mesas, isLoading } = useQuery({
    queryKey: ['mesas'],
    queryFn: async () => {
      const data = await mesasService.getAll();
      return data;
    },
  });

  // Crear orden mutation
  const crearOrdenMutation = useMutation({
    mutationFn: async (mesa) => {
      console.log('🔔 Creando orden para mesa:', mesa);
      const orden = await ordenesService.create({
        mesa_id: mesa.id,
        observaciones: `Orden desde Mesa ${mesa.numero}`
      });
      console.log('✅ Orden creada:', orden);
      return orden;
    },
    onSuccess: (data) => {
      console.log('🎉 Orden creada exitosamente, redirigiendo...');
      queryClient.invalidateQueries(['mesas']);
      toast.success(`Orden ${data.numero_comanda} creada - Mesa ${data.mesa_numero}`);
      // Redirigir a Pedidos con la orden creada
      setTimeout(() => {
        navigate(`/pedidos?orden_id=${data.id}`);
      }, 500);
    },
    onError: (error) => {
      console.error('❌ Error al crear orden:', error);
      toast.error(error.response?.data?.error?.message || 'Error al crear orden');
    },
  });

  // Create/Update mesa mutation
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (selectedMesa && editMode) {
        const numeroCambio = selectedMesa.numero !== data.numero;
        if (numeroCambio) {
          const mesaExiste = mesas?.find(m => 
            m.numero === data.numero && m.id !== selectedMesa.id
          );
          if (mesaExiste) {
            throw new Error(`Ya existe una mesa con el número ${data.numero}`);
          }
        }
        return await mesasService.update(selectedMesa.id, data);
      } else {
        const mesaExiste = mesas?.find(m => m.numero === data.numero);
        if (mesaExiste) {
          throw new Error(`Ya existe una mesa con el número ${data.numero}`);
        }
        return await mesasService.create(data);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['mesas']);
      toast.success(selectedMesa && editMode ? 'Mesa actualizada' : 'Mesa creada');
      setFormOpen(false);
      setSelectedMesa(null);
      setEditMode(false);
    },
    onError: (error) => {
      toast.error(error.message || error.response?.data?.error?.message || 'Error al guardar');
    },
  });

  // Update estado mutation
  const estadoMutation = useMutation({
    mutationFn: async ({ id, estado }) => {
      return await mesasService.updateEstado(id, estado);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['mesas']);
      toast.success(`Mesa ${data.numero} ahora está ${data.estado}`);
      if (selectedMesa) {
        setSelectedMesa(data);
      }
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Error al actualizar estado');
    },
  });

  // Filtrar mesas
  const filteredMesas = mesas?.filter((mesa) => {
    const matchesSearch = mesa.numero.toString().includes(searchTerm) ||
      mesa.ubicacion?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterEstado === 'todos' || mesa.estado === filterEstado;
    return matchesSearch && matchesFilter;
  });

  // Handlers
  const handleMesaClick = (mesa) => {
    setSelectedMesa(mesa);
    setDetalleOpen(true);
  };

  const handleNewMesa = () => {
    setSelectedMesa(null);
    setEditMode(false);
    setFormOpen(true);
  };

  const handleEditMesa = () => {
    setEditMode(true);
    setFormOpen(true);
    setDetalleOpen(false);
  };

  const handleSave = (data) => {
    saveMutation.mutate(data);
  };

  const handleEstadoChange = (nuevoEstado) => {
    if (selectedMesa) {
      if (nuevoEstado === 'ocupada') {
        toast.warning('El estado "Ocupada" se establece automáticamente al crear una orden');
        return;
      }
      if (nuevoEstado === 'libre' && selectedMesa.ordenes_activas > 0) {
        toast.error('No se puede liberar: tiene órdenes activas');
        return;
      }
      estadoMutation.mutate({ id: selectedMesa.id, estado: nuevoEstado });
    }
  };

  const handleNuevaOrden = (mesa) => {
    console.log('🔔 handleNuevaOrden llamado - Mesa:', mesa);
    if (mesa.estado !== 'libre') {
      toast.warning('Solo se puede crear orden en mesas libres');
      return;
    }
    console.log('✅ Creando orden...');
    crearOrdenMutation.mutate(mesa);
  };

  // Stats
  const stats = {
    total: mesas?.length || 0,
    libre: mesas?.filter(m => m.estado === 'libre').length || 0,
    ocupada: mesas?.filter(m => m.estado === 'ocupada').length || 0,
    reservada: mesas?.filter(m => m.estado === 'reservada').length || 0,
  };

  return (
  <div className="space-y-6">

    {/* ── HEADER ── */}

    {/* Móvil */}
    <div className="md:hidden bg-[#1e3a5f] -mx-4 -mt-4 px-4 pt-4 pb-3 mb-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-white font-semibold text-base">Mesas</h1>
          <p className="text-blue-300 text-xs">Gestión de mesas</p>
        </div>
        {user?.rol === 'administrador' && (
          <button
            onClick={handleNewMesa}
            disabled={saveMutation.isPending}
            className="bg-white/20 text-white text-xs px-3 py-1.5 rounded-lg flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Nueva Mesa
          </button>
        )}
      </div>

      {/* Stats compactos */}
      <div className="grid grid-cols-4 gap-2 mt-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-white/10 text-white' },
          { label: 'Libres', value: stats.libre, color: 'bg-green-500/30 text-green-200' },
          { label: 'Ocupadas', value: stats.ocupada, color: 'bg-red-500/30 text-red-200' },
          { label: 'Reservadas', value: stats.reservada, color: 'bg-yellow-500/30 text-yellow-200' },
        ].map(({ label, value, color }) => (
          <div key={label} className={`${color} rounded-lg px-2 py-1.5 text-center`}>
            <p className="text-[10px] opacity-80">{label}</p>
            <p className="text-lg font-semibold leading-tight">{value}</p>
          </div>
        ))}
      </div>
    </div>

    {/* Desktop: header original */}
    <div className="hidden md:flex md:items-center md:justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Mesas</h1>
        <p className="text-gray-500 mt-1">Gestión de mesas del restaurante</p>
      </div>
      {user?.rol === 'administrador' && (
        <Button onClick={handleNewMesa} disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-5 w-5 mr-2" /> Nueva Mesa
        </Button>
      )}
    </div>

    {/* ── STATS (solo desktop) ── */}
    <div className="hidden md:grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <p className="text-sm text-gray-500">Total Mesas</p>
        <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
      </div>
      <div className="bg-green-50 rounded-lg border border-green-200 p-4">
        <p className="text-sm text-green-600">Libres</p>
        <p className="text-2xl font-bold text-green-700">{stats.libre}</p>
      </div>
      <div className="bg-red-50 rounded-lg border border-red-200 p-4">
        <p className="text-sm text-red-600">Ocupadas</p>
        <p className="text-2xl font-bold text-red-700">{stats.ocupada}</p>
      </div>
      <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
        <p className="text-sm text-yellow-600">Reservadas</p>
        <p className="text-2xl font-bold text-yellow-700">{stats.reservada}</p>
      </div>
    </div>

    {/* ── FILTROS ── */}

    {/* Móvil: buscador + select compactos */}
    <div className="md:hidden px-1 space-y-2">
      <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
        <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
        <input
          className="bg-transparent text-sm flex-1 outline-none text-gray-700 placeholder-gray-400"
          placeholder="Buscar mesa..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {['todos', 'libre', 'ocupada', 'reservada', 'mantenimiento'].map((estado) => (
          <button
            key={estado}
            onClick={() => setFilterEstado(estado)}
            className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border capitalize transition-all ${
              filterEstado === estado
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white text-gray-600 border-gray-200'
            }`}
          >
            {estado === 'todos' ? 'Todos' : estado}
          </button>
        ))}
      </div>
    </div>

    {/* Desktop: filtros originales */}
    <div className="hidden md:flex flex-col md:flex-row gap-4">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
        <Input
          placeholder="Buscar por número o ubicación..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>
      <select
        value={filterEstado}
        onChange={(e) => setFilterEstado(e.target.value)}
        className="h-10 px-4 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <option value="todos">Todos los estados</option>
        <option value="libre">Libre</option>
        <option value="ocupada">Ocupada</option>
        <option value="reservada">Reservada</option>
        <option value="mantenimiento">Mantenimiento</option>
      </select>
    </div>

    {/* ── GRID DE MESAS ── */}
    {isLoading ? (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    ) : filteredMesas?.length === 0 ? (
      <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
        <p className="text-gray-500">No se encontraron mesas</p>
      </div>
    ) : (
      <>
        {/* Móvil: grid 2 columnas compacto */}
        <div className="md:hidden grid grid-cols-2 gap-3 px-1">
          {filteredMesas.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              onClick={handleMesaClick}
              onNuevaOrden={handleNuevaOrden}
              isLoading={crearOrdenMutation.isPending}
            />
          ))}
        </div>

        {/* Desktop: grid original */}
        <div className="hidden md:grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredMesas.map((mesa) => (
            <MesaCard
              key={mesa.id}
              mesa={mesa}
              onClick={handleMesaClick}
              onNuevaOrden={handleNuevaOrden}
              isLoading={crearOrdenMutation.isPending}
            />
          ))}
        </div>
      </>
    )}

    {/* ── MODAL DETALLE (sin cambios, funciona en ambos) ── */}
    {detalleOpen && selectedMesa && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Detalle de Mesa {selectedMesa.numero}
            </h2>
            <button onClick={() => setDetalleOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
              <span className="text-xl text-gray-500">×</span>
            </button>
          </div>
          <div className="px-6 py-4 space-y-4">
            <div className="flex justify-center">
              <MesaStatus estado={selectedMesa.estado} showLabel={true} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Utensils className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-gray-500">Nombre</p>
                  <p className="font-medium text-gray-900">Mesa {selectedMesa.numero}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-sm text-gray-500">Capacidad</p>
                  <p className="font-medium text-gray-900">{selectedMesa.capacidad} personas</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <MapPin className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-gray-500">Ubicación</p>
                  <p className="font-medium text-gray-900">{selectedMesa.ubicacion || 'No especificada'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Calendar className="h-5 w-5 text-orange-500" />
                <div>
                  <p className="text-sm text-gray-500">Creada</p>
                  <p className="font-medium text-gray-900">
                    {new Date(selectedMesa.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>
            <div className="border-t pt-4">
              <p className="text-sm text-gray-500 mb-3">Cambiar Estado</p>
              <div className="grid grid-cols-2 gap-2">
                {['libre', 'reservada', 'mantenimiento'].map((key) => {
                  const config = statusConfig[key];
                  const isDisabled = key === 'libre' && selectedMesa.ordenes_activas > 0;
                  return (
                    <button
                      key={key}
                      onClick={() => handleEstadoChange(key)}
                      disabled={isDisabled || estadoMutation.isPending}
                      className={cn(
                        "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
                        selectedMesa.estado === key
                          ? `${config.bgColor} ${config.textColor} border-2 border-current`
                          : "bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent",
                        isDisabled && "opacity-50 cursor-not-allowed"
                      )}
                    >
                      {config.label}
                      {isDisabled && ' ⚠️'}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                💡 El estado "Ocupada" se establece automáticamente al crear una orden
              </p>
            </div>
          </div>
          <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
            {user?.rol === 'administrador' && (
              <Button variant="outline" onClick={handleEditMesa}>Editar</Button>
            )}
            <Button variant="outline" onClick={() => setDetalleOpen(false)}>Cerrar</Button>
          </div>
        </div>
      </div>
    )}

    {/* ── MODAL FORMULARIO (sin cambios) ── */}
    {formOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {editMode ? 'Editar Mesa' : 'Nueva Mesa'}
            </h2>
          </div>
          <form onSubmit={(e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            handleSave({
              numero: parseInt(formData.get('numero')),
              capacidad: parseInt(formData.get('capacidad')),
              ubicacion: formData.get('ubicacion'),
              estado: formData.get('estado'),
            });
          }}>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Número</label>
                <input name="numero" type="number" defaultValue={editMode ? selectedMesa?.numero : ''} required className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacidad</label>
                <input name="capacidad" type="number" defaultValue={editMode ? selectedMesa?.capacidad : ''} required min="1" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ubicación</label>
                <input name="ubicacion" type="text" defaultValue={editMode ? selectedMesa?.ubicacion : ''} placeholder="Salón principal..." className="w-full px-3 py-2 border border-gray-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Estado</label>
                <select name="estado" defaultValue={editMode ? selectedMesa?.estado : 'libre'} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                  <option value="libre">Libre</option>
                  <option value="ocupada">Ocupada</option>
                  <option value="reservada">Reservada</option>
                  <option value="mantenimiento">Mantenimiento</option>
                </select>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
              <Button type="button" variant="outline" onClick={() => { setFormOpen(false); setEditMode(false); }}>Cancelar</Button>
              <Button type="submit" disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                {saveMutation.isPending ? 'Guardando...' : (editMode ? 'Actualizar' : 'Crear')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    )}
  </div>
);
};