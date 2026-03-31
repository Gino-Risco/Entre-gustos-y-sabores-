import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Users, Plus, Edit, UserX, UserCheck, Shield, ShieldAlert, KeyRound } from 'lucide-react';
import Swal from 'sweetalert2'; // 👈 Importamos SweetAlert2
import { usuariosService } from '@/services/usuarios.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export const Usuarios = () => {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsuario, setEditingUsuario] = useState(null);

  const [formData, setFormData] = useState({
    nombre: '',
    usuario: '',
    correo: '',
    password: '',
    rol_id: ''
  });

  // Fetch Usuarios
  const { data: usuarios, isLoading } = useQuery({
    queryKey: ['usuarios'],
    queryFn: usuariosService.getAll,
  });

  // Fetch Roles
  const { data: roles } = useQuery({
    queryKey: ['roles'],
    queryFn: usuariosService.getRoles,
  });

  // Mutaciones
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingUsuario) return await usuariosService.update(editingUsuario.id, data);
      return await usuariosService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['usuarios']);
      closeModal();
      // 👇 SweetAlert para Éxito 👇
      Swal.fire({
        title: editingUsuario ? '¡Actualizado!' : '¡Creado!',
        text: editingUsuario ? 'El usuario ha sido actualizado correctamente.' : 'El nuevo usuario está listo para usar el sistema.',
        icon: 'success',
        confirmButtonColor: '#2563eb',
      });
    },
    onError: (error) => {
      Swal.fire({
        title: 'Error',
        text: error.response?.data?.error?.message || 'Error al guardar el usuario',
        icon: 'error',
        confirmButtonColor: '#2563eb',
      });
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (id) => await usuariosService.delete(id),
    onSuccess: (data) => {
      queryClient.invalidateQueries(['usuarios']);
      // Mostramos el mensaje que nos devuelve el backend
      Swal.fire({
        title: '¡Listo!',
        text: data.message || 'El estado del usuario ha sido actualizado.',
        icon: 'success',
        confirmButtonColor: '#2563eb',
        timer: 2000,
        showConfirmButton: false
      });
    },
    onError: () => {
      Swal.fire('Error', 'No se pudo cambiar el estado del usuario', 'error');
    },
  });

  const openModal = (usuario = null) => {
    if (usuario) {
      setEditingUsuario(usuario);
      setFormData({
        nombre: usuario.nombre,
        usuario: usuario.usuario,
        correo: usuario.correo || '',
        password: '',
        rol_id: usuario.rol_id
      });
    } else {
      setEditingUsuario(null);
      setFormData({ nombre: '', usuario: '', correo: '', password: '', rol_id: '' });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUsuario(null);
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSave = { ...formData };
    if (editingUsuario && !dataToSave.password) {
      delete dataToSave.password;
    }
    saveMutation.mutate(dataToSave);
  };

  // 👇 Lógica de SweetAlert para confirmar la baja/reactivación 👇
  const handleToggleStatus = (user) => {
    const isActivo = user.activo;
    
    Swal.fire({
      title: isActivo ? '¿Dar de baja?' : '¿Reactivar usuario?',
      text: isActivo 
        ? `¿Estás seguro de quitar el acceso a ${user.nombre}?` 
        : `¿Quieres devolverle el acceso al sistema a ${user.nombre}?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: isActivo ? '#dc2626' : '#16a34a',
      cancelButtonColor: '#6b7280',
      confirmButtonText: isActivo ? 'Sí, dar de baja' : 'Sí, reactivar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed) {
        toggleStatusMutation.mutate(user.id);
      }
    });
  };

  const getRolBadge = (rol_nombre) => {
    const estilos = {
      'administrador': 'bg-red-100 text-red-800 border-red-200',
      'cajero': 'bg-blue-100 text-blue-800 border-blue-200',
      'mesero': 'bg-green-100 text-green-800 border-green-200'
    };
    return estilos[rol_nombre] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Users className="h-8 w-8 text-blue-600" />
            Gestión de Personal
          </h1>
          <p className="text-gray-500 mt-1">Administra los accesos y roles del sistema</p>
        </div>
        <Button onClick={() => openModal()} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-5 w-5 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="text-xs text-gray-700 uppercase bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-4">Personal</th>
                <th className="px-6 py-4">Usuario (Login)</th>
                <th className="px-6 py-4">Rol</th>
                <th className="px-6 py-4">Estado</th>
                <th className="px-6 py-4 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan="5" className="text-center py-8">Cargando usuarios...</td></tr>
              ) : usuarios?.map((user) => (
                <tr key={user.id} className={cn("border-b hover:bg-gray-50 transition-colors", !user.activo && "opacity-60 bg-gray-50")}>
                  <td className="px-6 py-4">
                    <div className={cn("font-medium", user.activo ? "text-gray-900" : "text-gray-500")}>{user.nombre}</div>
                    <div className="text-xs text-gray-500">{user.correo || 'Sin correo'}</div>
                  </td>
                  <td className="px-6 py-4 font-mono text-gray-600">@{user.usuario}</td>
                  <td className="px-6 py-4">
                    <Badge variant="outline" className={getRolBadge(user.rol_nombre)}>
                      {user.rol_nombre === 'administrador' ? <ShieldAlert className="w-3 h-3 mr-1"/> : <Shield className="w-3 h-3 mr-1"/>}
                      {user.rol_nombre.toUpperCase()}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
                    {/* 👇 Etiqueta visual para Activo / Inactivo 👇 */}
                    {user.activo ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-none">Activo</Badge>
                    ) : (
                      <Badge className="bg-red-100 text-red-700 hover:bg-red-100 border-none">Inactivo</Badge>
                    )}
                  </td>
                  <td className="px-6 py-4 flex justify-center gap-2">
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => openModal(user)} 
                      title="Editar/Cambiar Clave"
                      disabled={!user.activo} // No dejamos editar si está inactivo
                    >
                      <Edit className="h-4 w-4 text-blue-600" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon" 
                      onClick={() => handleToggleStatus(user)} 
                      title={user.activo ? "Dar de baja" : "Reactivar"}
                      className={user.activo ? "hover:bg-red-50" : "hover:bg-green-50"}
                    >
                      {user.activo ? (
                        <UserX className="h-4 w-4 text-red-600" />
                      ) : (
                        <UserCheck className="h-4 w-4 text-green-600" />
                      )}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Crear / Editar */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              {editingUsuario ? <Edit className="w-5 h-5"/> : <Plus className="w-5 h-5"/>}
              {editingUsuario ? 'Editar Usuario' : 'Nuevo Usuario'}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>Nombre Completo *</Label>
                <Input name="nombre" value={formData.nombre} onChange={handleChange} required placeholder="Ej: Juan Pérez" />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Usuario *</Label>
                  <Input name="usuario" value={formData.usuario} onChange={handleChange} required placeholder="Ej: jperez" className="font-mono" />
                </div>
                <div>
                  <Label>Rol de Acceso *</Label>
                  <select name="rol_id" value={formData.rol_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md">
                    <option value="">Seleccione...</option>
                    {roles?.map(rol => <option key={rol.id} value={rol.id}>{rol.nombre.toUpperCase()}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <Label>Correo Electrónico (Opcional)</Label>
                <Input name="correo" type="email" value={formData.correo} onChange={handleChange} placeholder="correo@ejemplo.com" />
              </div>

              <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
                <Label className="flex items-center gap-2 text-gray-700">
                  <KeyRound className="w-4 h-4"/> 
                  {editingUsuario ? 'Nueva Contraseña (Opcional)' : 'Contraseña *'}
                </Label>
                <Input 
                  name="password" 
                  type="password" 
                  value={formData.password} 
                  onChange={handleChange} 
                  required={!editingUsuario} 
                  placeholder={editingUsuario ? "Dejar en blanco para mantener la actual" : "Mínimo 6 caracteres"} 
                  className="mt-1"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button type="button" variant="outline" onClick={closeModal}>Cancelar</Button>
                <Button type="submit" disabled={saveMutation.isPending} className="bg-blue-600 hover:bg-blue-700">
                  {saveMutation.isPending ? 'Guardando...' : 'Guardar Personal'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};