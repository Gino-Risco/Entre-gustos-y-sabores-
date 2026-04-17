import { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save, Package, DollarSign, ListTodo, Image as ImageIcon, Upload, Loader2, X, Utensils } from 'lucide-react';
import { toast } from 'sonner';
import { productosService } from '@/services/productos.service';
import { categoriasService } from '@/services/categorias.service';
import api from '@/services/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export const ProductoForm = ({ modo }) => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isEditMode = !!id;

  const [isUploading, setIsUploading] = useState(false);

  const [formData, setFormData] = useState({
    nombre: '',
    descripcion: '',
    categoria_id: '',
    tipo: 'preparado', // Valor por defecto
    precio_venta: '',
    costo_promedio: '',
    disponible_en_menu: false,
    control_stock: false,
    unidad_medida: 'unidad',
    stock_actual: '0',
    stock_minimo: '0',
    imagen_url: '' 
  });

  // CONFIGURACIÓN DINÁMICA SEGÚN MODO
  const config = {
    isCarta: modo === 'carta' || (isEditMode && formData.tipo === 'preparado'),
    isAlmacen: modo === 'almacen' || (isEditMode && (formData.tipo === 'insumo' || formData.tipo === 'empacado')),
    titulo: isEditMode ? 'Editar Detalle' : (modo === 'carta' ? 'Nuevo Plato' : 'Nuevo Producto'),
    subtitulo: modo === 'carta' 
      ? 'Configura el nombre, precio y foto para tu carta.' 
      : 'Gestiona el stock y costos de tus insumos o bebidas.',
    colorPrincipal: modo === 'carta' ? 'text-cyan-600' : 'text-blue-600',
    colorBoton: modo === 'carta' ? 'bg-cyan-600 hover:bg-cyan-700' : 'bg-blue-600 hover:bg-blue-700',
    backUrl: modo === 'carta' ? '/productos/carta' : '/productos/almacen'
  };

  // Forzar tipo de producto al crear
  useEffect(() => {
    if (!isEditMode) {
      if (modo === 'carta') {
        setFormData(prev => ({ ...prev, tipo: 'preparado', control_stock: false }));
      } else if (modo === 'almacen') {
        setFormData(prev => ({ ...prev, tipo: 'insumo', control_stock: true }));
      }
    }
  }, [modo, isEditMode]);

  const { data: categorias } = useQuery({
    queryKey: ['categorias'],
    queryFn: async () => await categoriasService.getAll(),
  });

  const { isLoading: isLoadingProducto } = useQuery({
    queryKey: ['producto', id],
    queryFn: async () => {
      const data = await productosService.getAll({ incluir_inactivos: true });
      const producto = data.find(p => p.id === parseInt(id));
      if (producto) {
        setFormData({
          nombre: producto.nombre || '',
          descripcion: producto.descripcion || '',
          categoria_id: producto.categoria_id || '',
          tipo: producto.tipo || 'preparado',
          precio_venta: producto.precio_venta || '',
          costo_promedio: producto.costo_promedio || '',
          disponible_en_menu: producto.disponible_en_menu || false,
          control_stock: producto.control_stock || false,
          unidad_medida: producto.unidad_medida || 'unidad',
          stock_actual: producto.stock_actual || '0',
          stock_minimo: producto.stock_minimo || '0',
          imagen_url: producto.imagen_url || ''
        });
      }
      return producto;
    },
    enabled: isEditMode,
  });

  const saveMutation = useMutation({
    mutationFn: async (dataToSave) => {
      if (isEditMode) return await productosService.update(id, dataToSave);
      return await productosService.create(dataToSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['productos']);
      queryClient.invalidateQueries(['productos-carta']);
      queryClient.invalidateQueries(['productos-almacen']);
      toast.success(isEditMode ? 'Actualizado correctamente' : 'Creado correctamente');
      navigate(config.backUrl);
    },
    onError: (error) => toast.error(error.response?.data?.error?.message || 'Error al guardar'),
  });

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => {
      const newData = { ...prev, [name]: type === 'checkbox' ? checked : value };
      if (name === 'tipo') {
        if (value === 'insumo' || value === 'empacado') newData.control_stock = true;
        else if (value === 'preparado') newData.control_stock = false;
      }
      return newData;
    });
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('La imagen es muy pesada (Máximo 5MB)');
      return;
    }
    const uploadData = new FormData();
    uploadData.append('imagen', file);
    setIsUploading(true);
try {
      const response = await api.post('/upload', uploadData, {
        headers: {
          // El secreto está aquí: 'undefined' anula el JSON por defecto de tu api.js
          // y deja que el navegador arme el paquete del archivo automáticamente.
          'Content-Type': undefined 
        }
      });
      
      const result = response.data;

      if (result.success) {
        setFormData(prev => ({ ...prev, imagen_url: result.data.url }));
        toast.success('Imagen subida correctamente');
      } else {
        throw new Error(result.message);
      }
    } catch (error) {
      console.error("Error subiendo imagen:", error);
      toast.error('Error al subir la imagen al servidor');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const dataToSave = {
      ...formData,
      categoria_id: parseInt(formData.categoria_id),
      precio_venta: formData.tipo === 'insumo' ? 0 : parseFloat(formData.precio_venta) || 0,
      costo_promedio: parseFloat(formData.costo_promedio) || 0,
      stock_actual: parseInt(formData.stock_actual) || 0,
      stock_minimo: parseInt(formData.stock_minimo) || 0,
    };
    saveMutation.mutate(dataToSave);
  };

  if (isEditMode && isLoadingProducto) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="space-y-6 max-w-10xl mx-auto pb-10">
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={() => navigate(config.backUrl)}>
          <ArrowLeft className="h-5 w-5 mr-2" /> Volver
        </Button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
             {modo === 'carta' ? <Utensils className={`h-8 w-8 ${config.colorPrincipal}`} /> : <Package className={`h-8 w-8 ${config.colorPrincipal}`} />}
             {config.titulo}
          </h1>
          <p className="text-gray-500 mt-1">{config.subtitulo}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Package className="h-5 w-5 text-gray-500"/> Información General
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div><Label>Nombre del {config.isCarta ? 'Plato' : 'Producto'} *</Label><Input name="nombre" value={formData.nombre} onChange={handleChange} placeholder={config.isCarta ? "Ej: Ceviche de Pescado" : "Ej: Arroz Costeño"} required /></div>
                <div><Label>Descripción</Label><Input name="descripcion" value={formData.descripcion} onChange={handleChange} placeholder="Breve detalle..." /></div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Categoría *</Label>
                    <select name="categoria_id" value={formData.categoria_id} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
                      <option value="">Seleccionar...</option>
                      {categorias?.map((cat) => (<option key={cat.id} value={cat.id}>{cat.nombre}</option>))}
                    </select>
                  </div>
                  {/* El selector de TIPO solo aparece en ALMACÉN o edición */}
                  {config.isAlmacen && (
                    <div>
                      <Label>Tipo de Artículo *</Label>
                      <select name="tipo" value={formData.tipo} onChange={handleChange} required className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500">
                        <option value="insumo">Insumo (Stock manual)</option>
                        <option value="empacado">Empacado (Stock automático)</option>
                      </select>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="h-5 w-5 text-gray-500"/> Precios y Costos</CardTitle></CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {/* En insumos puros no se suele mostrar precio de venta */}
                  {formData.tipo !== 'insumo' && (
                    <div>
                      <Label>Precio de Venta *</Label>
                      <Input name="precio_venta" type="number" step="0.01" min="0" value={formData.precio_venta} onChange={handleChange} placeholder="0.00" required />
                    </div>
                  )}
                  <div><Label>Costo Promedio</Label><Input name="costo_promedio" type="number" step="0.01" min="0" value={formData.costo_promedio} onChange={handleChange} placeholder="0.00" /></div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            {/* FOTO: Importante en Carta y productos empacados */}
            {(config.isCarta || formData.tipo === 'empacado') && (
              <Card>
                <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><ImageIcon className="h-5 w-5 text-gray-500"/> Foto de Presentación</CardTitle></CardHeader>
                <CardContent>
                  {formData.imagen_url ? (
                    <div className="relative rounded-lg overflow-hidden border border-gray-200 group">
                      <img src={formData.imagen_url} alt="Vista previa" className="w-full h-48 object-cover" />
                      <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button type="button" variant="destructive" size="sm" onClick={() => setFormData(prev => ({ ...prev, imagen_url: '' }))} className="flex items-center gap-2">
                          <X className="h-4 w-4" /> Quitar foto
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <label className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${isUploading ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                      <div className="flex flex-col items-center justify-center pt-5 pb-6">
                        {isUploading ? <Loader2 className="w-10 h-10 text-blue-500 animate-spin mb-3" /> : <Upload className="w-10 h-10 text-gray-400 mb-3" />}
                        <p className="text-sm text-gray-500 font-medium">{isUploading ? 'Subiendo...' : 'Subir Imagen'}</p>
                      </div>
                      <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
                    </label>
                  )}
                </CardContent>
              </Card>
            )}

            {/* INVENTARIO: Solo en modo Almacén */}
            {config.isAlmacen && (
              <Card>
                <CardHeader className="pb-4"><CardTitle className="flex items-center gap-2 text-lg"><ListTodo className="h-5 w-5 text-gray-500"/> Control de Inventario</CardTitle></CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Label>Unidad *</Label>
                      <select name="unidad_medida" value={formData.unidad_medida} onChange={handleChange} className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-md">
                        <option value="unidad">unid</option>
                        <option value="kg">kg</option>
                        <option value="lt">lt</option>
                        <option value="gr">gr</option>
                      </select>
                    </div>
                    <div><Label>Stock Mín.</Label><Input name="stock_minimo" type="number" value={formData.stock_minimo} onChange={handleChange} className="mt-1" /></div>
                    <div>
                      <Label>{isEditMode ? 'Stock Actual' : 'Stock Inicial'}</Label>
                      <Input name="stock_actual" type="number" value={formData.stock_actual} onChange={handleChange} disabled={isEditMode} className={`mt-1 ${isEditMode ? 'bg-gray-100' : ''}`} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* OPCIONES DE MENÚ: Solo para platos */}
            {config.isCarta && (
               <Card>
                 <CardContent className="pt-6">
                    <label className="flex items-start gap-3 cursor-pointer p-3 bg-purple-50 rounded-lg border border-purple-100">
                      <input type="checkbox" name="disponible_en_menu" checked={formData.disponible_en_menu} onChange={handleChange} className="mt-1 rounded text-purple-600 h-4 w-4" />
                      <div>
                        <span className="font-semibold text-purple-900">Disponible en Menú del Día</span>
                        <p className="text-xs text-purple-700">Aparecerá como opción en la toma de pedidos rápidos.</p>
                      </div>
                    </label>
                 </CardContent>
               </Card>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-4 pt-4 border-t">
          <Button type="button" variant="outline" size="lg" onClick={() => navigate(config.backUrl)}>Cancelar</Button>
          <Button type="submit" size="lg" disabled={saveMutation.isPending || isUploading} className={config.colorBoton}>
            <Save className="h-5 w-5 mr-2" />
            {saveMutation.isPending ? 'Guardando...' : (isEditMode ? 'Guardar Cambios' : 'Registrar')}
          </Button>
        </div>
      </form>
    </div>
  );
};