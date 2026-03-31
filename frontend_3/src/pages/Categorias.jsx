import { useState } from 'react';
import { Plus } from 'lucide-react';
import Swal from 'sweetalert2';
import { useCategorias } from '@/hooks/useCategorias';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CategoriaList } from '@/components/categorias/CategoriaList';
import { CategoriaModal } from '@/components/categorias/CategoriaModal';

export const Categorias = () => {
  const { categorias, isLoading, saveMutation, deleteMutation } = useCategorias();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCategoria, setSelectedCategoria] = useState(null);

  const handleNew = () => {
    setSelectedCategoria(null);
    setModalOpen(true);
  };

  const handleEdit = (categoria) => {
    setSelectedCategoria(categoria);
    setModalOpen(true);
  };

  const handleDelete = async (categoria) => {
    const result = await Swal.fire({
      title: '¿Eliminar categoría?',
      text: `¿Estás seguro de eliminar "${categoria.nombre}"? Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });

    if (result.isConfirmed) {
      deleteMutation.mutate(categoria.id);
    }
  };

  const handleSave = ({ id, data }) => {
    saveMutation.mutate({ id, data });
    setModalOpen(false);
    setSelectedCategoria(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Categorías</h1>
          <p className="text-gray-500 mt-1">Gestión de categorías de productos</p>
        </div>
        <Button onClick={handleNew} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="h-5 w-5 mr-2" />
          Nueva Categoría
        </Button>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Categorías</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <CategoriaList
              categorias={categorias}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      <CategoriaModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedCategoria(null);
        }}
        categoria={selectedCategoria}
        onSave={handleSave}
        isLoading={saveMutation.isPending}
      />
    </div>
  );
};