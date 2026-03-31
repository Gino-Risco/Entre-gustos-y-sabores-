import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { categoriasService } from '@/services/categorias.service';
import { toast } from 'sonner';

export const useCategorias = () => {
  const queryClient = useQueryClient();

  // Fetch todas las categorías
  const { data: categorias, isLoading } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => {
      const data = await categoriasService.getAll();
      return data;
    },
  });

  // Crear/Actualizar mutation
  const saveMutation = useMutation({
    mutationFn: async ({ id, data }) => {
      if (id) {
        return await categoriasService.update(id, data);
      }
      return await categoriasService.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorias']);
      toast.success('Categoría guardada correctamente');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Error al guardar categoría');
    },
  });

  // Eliminar mutation
  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      return await categoriasService.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['categorias']);
      toast.success('Categoría eliminada correctamente');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error?.message || 'Error al eliminar categoría');
    },
  });

  return {
    categorias,
    isLoading,
    saveMutation,
    deleteMutation,
  };
};