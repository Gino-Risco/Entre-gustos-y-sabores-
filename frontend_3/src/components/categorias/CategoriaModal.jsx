import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { CategoriaForm } from './CategoriaForm';

export const CategoriaModal = ({ open, onClose, categoria, onSave, isLoading }) => {
  const handleSave = (data) => {
    onSave({ id: categoria?.id, data });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {categoria ? 'Editar Categoría' : 'Nueva Categoría'}
          </DialogTitle>
        </DialogHeader>
        <CategoriaForm
          categoria={categoria}
          onSave={handleSave}
          onCancel={onClose}
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};