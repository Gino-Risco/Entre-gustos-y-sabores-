import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2 } from 'lucide-react';
import Swal from 'sweetalert2';
import { comprasService } from '@/services/compras.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export const Proveedores = () => {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [proveedorEdit, setProveedorEdit] = useState(null);
  const [formData, setFormData] = useState({ nombre: '', ruc: '', telefono: '', direccion: '', email: '', tipo_producto: '' });

  const { data: proveedores, isLoading } = useQuery({
    queryKey: ['proveedores'],
    queryFn: async () => await comprasService.getAllProveedores(),
  });

  const handleOpenModal = (proveedor = null) => {
    if (proveedor) {
      setProveedorEdit(proveedor);
      setFormData({ nombre: proveedor.nombre, ruc: proveedor.ruc || '', telefono: proveedor.telefono || '', direccion: proveedor.direccion || '', email: proveedor.email || '', tipo_producto: proveedor.tipo_producto || '' });
    } else {
      setProveedorEdit(null);
      setFormData({ nombre: '', ruc: '', telefono: '', direccion: '', email: '', tipo_producto: '' });
    }
    setShowModal(true);
  };

  const handleGuardar = async () => {
    if (!formData.nombre.trim()) {
      Swal.fire({ icon: 'warning', title: 'Nombre requerido' });
      return;
    }
    try {
      if (proveedorEdit) {
        await comprasService.updateProveedor(proveedorEdit.id, formData);
        Swal.fire({ icon: 'success', title: 'Proveedor actualizado', timer: 1500, showConfirmButton: false });
      } else {
        await comprasService.createProveedor(formData);
        Swal.fire({ icon: 'success', title: 'Proveedor creado', timer: 1500, showConfirmButton: false });
      }
      setShowModal(false);
      queryClient.invalidateQueries(['proveedores']);
    } catch (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al guardar' });
    }
  };

  const handleEliminar = async (id) => {
    const result = await Swal.fire({ title: '¿Eliminar proveedor?', text: 'Esta acción no se puede deshacer', icon: 'warning', showCancelButton: true, confirmButtonText: 'Sí, eliminar', cancelButtonText: 'Cancelar', confirmButtonColor: '#dc2626' });
    if (result.isConfirmed) {
      try {
        await comprasService.deleteProveedor(id);
        Swal.fire({ icon: 'success', title: 'Proveedor eliminado', timer: 1500, showConfirmButton: false });
        queryClient.invalidateQueries(['proveedores']);
      } catch (error) {
        Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'No se puede eliminar (tiene compras asociadas)' });
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div><h1 className="text-3xl font-bold text-gray-900">Proveedores</h1><p className="text-gray-500 mt-1">Gestión de proveedores</p></div>
        <Button onClick={() => handleOpenModal()} className="bg-blue-600 hover:bg-blue-700"><Plus className="h-5 w-5 mr-2" /> Nuevo Proveedor</Button>
      </div>

      <Card>
        <CardHeader><CardTitle>Lista de Proveedores</CardTitle></CardHeader>
        <CardContent>
          {isLoading ? (<div className="flex justify-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>) : proveedores?.length === 0 ? (<div className="text-center py-12 text-gray-500">No hay proveedores registrados</div>) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4">Nombre</th>
                    <th className="text-left py-3 px-4">RUC</th>
                    <th className="text-left py-3 px-4">Teléfono</th>
                    <th className="text-left py-3 px-4">Email</th>
                    <th className="text-right py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {proveedores.map((p) => (
                    <tr key={p.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4 font-medium">{p.nombre}</td>
                      <td className="py-3 px-4">{p.ruc || '-'}</td>
                      <td className="py-3 px-4">{p.telefono || '-'}</td>
                      <td className="py-3 px-4">{p.email || '-'}</td>
                      <td className="py-3 px-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleOpenModal(p)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEliminar(p.id)} className="text-red-600 hover:text-red-700"><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-semibold mb-4">{proveedorEdit ? 'Editar Proveedor' : 'Nuevo Proveedor'}</h3>
            <div className="space-y-4">
              <div><label className="block text-sm font-medium mb-1">Nombre *</label><Input value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} /></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-medium mb-1">RUC</label><Input value={formData.ruc} onChange={(e) => setFormData({...formData, ruc: e.target.value})} /></div>
                <div><label className="block text-sm font-medium mb-1">Teléfono</label><Input value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} /></div>
              </div>
              <div><label className="block text-sm font-medium mb-1">Email</label><Input type="email" value={formData.email} onChange={(e) => setFormData({...formData, email: e.target.value})} /></div>
              <div><label className="block text-sm font-medium mb-1">Dirección</label><textarea value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} rows="2" className="w-full px-3 py-2 border border-gray-300 rounded-md"></textarea></div>
              <div><label className="block text-sm font-medium mb-1">Tipo de Producto</label><Input value={formData.tipo_producto} onChange={(e) => setFormData({...formData, tipo_producto: e.target.value})} placeholder="Ej: Insumos varios, Bebidas, etc." /></div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setShowModal(false)}>Cancelar</Button>
              <Button onClick={handleGuardar} className="bg-blue-600 hover:bg-blue-700">{proveedorEdit ? 'Actualizar' : 'Guardar'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};