import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export const CategoriaForm = ({ categoria, onSave, onCancel, isLoading }) => {
  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    color: '#3b82f6',
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (categoria) {
      setFormData({
        nombre: categoria.nombre || '',
        descripcion: categoria.descripcion || '',
        color: categoria.color || '#3b82f6',
      });
    } else {
      setFormData({
        nombre: '',
        descripcion: '',
        color: '#3b82f6',
      });
    }
    setErrors({});
  }, [categoria]);

  const validate = () => {
    const newErrors = {};
    if (!formData.nombre.trim()) {
      newErrors.nombre = 'El nombre es requerido';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    onSave(formData);
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          value={formData.nombre}
          onChange={(e) => handleChange('nombre', e.target.value)}
          placeholder="Ej: Bebidas"
          className={errors.nombre ? 'border-red-500' : ''}
        />
        {errors.nombre && <p className="text-sm text-red-600 mt-1">{errors.nombre}</p>}
      </div>

      <div>
        <Label htmlFor="descripcion">Descripción</Label>
        <Input
          id="descripcion"
          value={formData.descripcion}
          onChange={(e) => handleChange('descripcion', e.target.value)}
          placeholder="Ej: Bebidas alcohólicas y no alcohólicas"
        />
      </div>

      <div>
        <Label htmlFor="color">Color</Label>
        <div className="flex gap-2">
          <Input
            id="color"
            type="color"
            value={formData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            className="w-20 h-10"
          />
          <Input
            type="text"
            value={formData.color}
            onChange={(e) => handleChange('color', e.target.value)}
            placeholder="#3b82f6"
            className="flex-1"
          />
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-4">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : (categoria ? 'Actualizar' : 'Crear')}
        </Button>
      </div>
    </form>
  );
};