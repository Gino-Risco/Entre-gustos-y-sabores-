import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const estados = [
  { value: 'libre', label: 'Libre' },
  { value: 'ocupada', label: 'Ocupada' },
  { value: 'reservada', label: 'Reservada' },
  { value: 'mantenimiento', label: 'Mantenimiento' },
];

export const MesaForm = ({ open, onClose, mesa, onSave, isLoading }) => {
  const [formData, setFormData] = useState({
    numero: '',
    capacidad: '',
    ubicacion: '',
    estado: 'libre',
  });
  const [errors, setErrors] = useState({});

  // Reset form when modal opens/closes
  useEffect(() => {
    if (open) {
      if (mesa) {
        setFormData({
          numero: mesa.numero || '',
          capacidad: mesa.capacidad || '',
          ubicacion: mesa.ubicacion || '',
          estado: mesa.estado || 'libre',
        });
      } else {
        setFormData({
          numero: '',
          capacidad: '',
          ubicacion: '',
          estado: 'libre',
        });
      }
      setErrors({});
    }
  }, [mesa, open]);

  const validate = () => {
    const newErrors = {};
    if (!formData.numero) {
      newErrors.numero = 'El número es requerido';
    }
    if (!formData.capacidad || parseInt(formData.capacidad) < 1) {
      newErrors.capacidad = 'La capacidad mínima es 1';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    
    onSave({
      ...formData,
      numero: parseInt(formData.numero),
      capacidad: parseInt(formData.capacidad),
    });
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: '' }));
    }
  };

  // Si no está abierto, no renderizar nada
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative bg-white rounded-lg shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            {mesa ? 'Editar Mesa' : 'Nueva Mesa'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="numero">Número de Mesa *</Label>
              <Input
                id="numero"
                type="number"
                placeholder="Ej: 1"
                value={formData.numero}
                onChange={(e) => handleChange('numero', e.target.value)}
                className={errors.numero ? 'border-red-500' : ''}
              />
              {errors.numero && (
                <p className="text-sm text-red-600">{errors.numero}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="capacidad">Capacidad (personas) *</Label>
              <Input
                id="capacidad"
                type="number"
                placeholder="Ej: 4"
                value={formData.capacidad}
                onChange={(e) => handleChange('capacidad', e.target.value)}
                className={errors.capacidad ? 'border-red-500' : ''}
              />
              {errors.capacidad && (
                <p className="text-sm text-red-600">{errors.capacidad}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ubicacion">Ubicación</Label>
              <Input
                id="ubicacion"
                type="text"
                placeholder="Ej: Salón principal, Terraza"
                value={formData.ubicacion}
                onChange={(e) => handleChange('ubicacion', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="estado">Estado</Label>
              <select
                id="estado"
                value={formData.estado}
                onChange={(e) => handleChange('estado', e.target.value)}
                className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {estados.map((estado) => (
                  <option key={estado.value} value={estado.value}>
                    {estado.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 flex gap-2 justify-end bg-gray-50">
            <Button 
              type="button" 
              variant="outline" 
              onClick={onClose}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isLoading ? 'Guardando...' : (mesa ? 'Actualizar' : 'Crear')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};