import { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Send, ChefHat, Clock, DollarSign, ArrowLeft, Receipt, Printer, Utensils, Search, Gift, History } from 'lucide-react';
import Swal from 'sweetalert2';
import { ordenesService } from '@/services/ordenes.service';
import { productosService } from '@/services/productos.service';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

export const Pedidos = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ordenId = searchParams.get('orden_id');

  const user = { rol: 'administrador' };
  const isAdminOCajero = user?.rol === 'administrador' || user?.rol === 'cajero';

  const [selectedProductos, setSelectedProductos] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('todos');
  const [showMenuModal, setShowMenuModal] = useState(false);
  const [menuSeleccion, setMenuSeleccion] = useState({ entrada: null, fondo: null });
  const [observaciones, setObservaciones] = useState({});

  useEffect(() => {
    setSelectedProductos([]);
    setMenuSeleccion({ entrada: null, fondo: null });
  }, [ordenId]);

  const { data: orden, isLoading: ordenLoading, refetch: refetchOrden } = useQuery({
    queryKey: ['orden', ordenId],
    queryFn: async () => {
      const data = await ordenesService.getById(ordenId);
      return data;
    },
    enabled: !!ordenId,
    staleTime: 0,
  });

  const { data: ordenes, isLoading: ordenesLoading } = useQuery({
    queryKey: ['ordenes', 'abiertas'],
    queryFn: async () => {
      return await ordenesService.getAll({ estado: 'abierta' });
    },
    enabled: !ordenId,
    staleTime: 30000,
  });

  const { data: productos, isLoading: productosLoading } = useQuery({
    queryKey: ['productos'],
    queryFn: async () => {
      const data = await productosService.getAll({ activo: true });
      return data.map(p => ({
        ...p,
        precio_venta: parseFloat(p.precio_venta) || 0,
      }));
    },
  });

  const { data: productosMenu } = useQuery({
    queryKey: ['productos-menu'],
    queryFn: async () => {
      const data = await ordenesService.getProductosParaMenu();
      return data.map(p => ({
        ...p,
        precio_venta: parseFloat(p.precio_venta) || 0,
      }));
    },
  });

  const agregarDetalleMutation = useMutation({
    mutationFn: async (detalles) => {
      return await ordenesService.agregarDetalles(ordenId, detalles);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({ icon: 'success', title: '¡Productos agregados!', timer: 1500, showConfirmButton: false });
      setSelectedProductos([]);
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al agregar' });
    },
  });

  // ✅ AQUÍ ESTÁ LA LÓGICA NUEVA DE NOMBRE CLIENTE EN EL POPUP
  const crearOrdenMutation = useMutation({
    mutationFn: async (tipo = 'llevar') => {
      const { value: nombreCliente, isConfirmed } = await Swal.fire({
        title: '🛍️ Nuevo Pedido Para Llevar',
        html: `
          <p style="color:#6b7280;margin-bottom:12px;font-size:14px;">Ingresa el nombre del cliente para identificar el pedido</p>
          <input 
            id="nombre_cliente" 
            class="swal2-input" 
            placeholder="Ej: María, Juan García..." 
            maxlength="100"
            style="font-size:16px;"
            autofocus
          />
        `,
        showCancelButton: true,
        confirmButtonText: '✓ Crear Pedido',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#f97316',
        focusConfirm: false,
        preConfirm: () => {
          const val = document.getElementById('nombre_cliente').value.trim();
          if (!val) {
            Swal.showValidationMessage('El nombre del cliente es requerido');
            return false;
          }
          return val;
        },
      });

      if (!isConfirmed || !nombreCliente) return null;

      return await ordenesService.create({
        tipo_pedido: tipo,
        mesa_id: null,
        nombre_cliente: nombreCliente, // SE ENVÍA EL NOMBRE
        observaciones: 'Pedido rápido para llevar'
      });
    },
    onSuccess: (nuevaOrden) => {
      if (!nuevaOrden) return; // Si canceló el modal
      queryClient.invalidateQueries(['ordenes']);
      setSearchParams({ orden_id: nuevaOrden.id });
      Swal.fire({ icon: 'success', title: `Pedido de ${nuevaOrden.nombre_cliente || 'Llevar'} creado`, timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'No se pudo crear el pedido' });
    },
  });

  const eliminarDetalleMutation = useMutation({
    mutationFn: async ({ ordenId, detalleId }) => {
      return await ordenesService.eliminarDetalle(ordenId, detalleId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({ icon: 'success', title: '¡Eliminado!', timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al eliminar' });
    },
  });

  // Mutación para anular un plato (Cortesía)
  const aplicarCortesiaMutation = useMutation({
    mutationFn: async ({ ordenId, detalleId, motivo }) => {
      return await ordenesService.aplicarCortesia(ordenId, detalleId, motivo);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({
        icon: 'success',
        title: 'Cortesía Aplicada',
        text: 'El precio del plato ahora es S/ 0.00',
        timer: 2000,
        showConfirmButton: false
      });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al aplicar cortesía' });
    }
  });

  const enviarCocinaMutation = useMutation({
    mutationFn: async (notasLocales) => {
      return await ordenesService.enviarCocina(ordenId, notasLocales);
    },
    onSuccess: (data, notasLocales) => {
      queryClient.invalidateQueries(['orden', ordenId]);
      queryClient.invalidateQueries(['ordenes']);
      if (data.imprimir) {
        const detallesParaTicket = data.detalles.map(d => ({
          ...d,
          observaciones: notasLocales[d.id] || d.observaciones
        }));
        imprimirTicketCocina(data.orden, detallesParaTicket);
      }
      setObservaciones({});
      Swal.fire({ icon: 'success', title: '¡Enviado a cocina!', timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al enviar' });
    },
  });

  const cerrarOrdenMutation = useMutation({
    mutationFn: async (datosPago) => {
      return await ordenesService.cerrar(ordenId, datosPago);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries(['orden', ordenId]);
      queryClient.invalidateQueries(['ordenes']);
      queryClient.invalidateQueries(['mesas']);
      if (data.imprimir) {
        imprimirComprobanteCaja(data.orden);
      }
      Swal.fire({ icon: 'success', title: '¡Orden cobrada!', timer: 2000, showConfirmButton: false });
      setSearchParams({});
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al cobrar' });
    },
  });

  // 👇 NUEVA MUTACIÓN PARA ANULAR ORDEN 👇
  const anularOrdenMutation = useMutation({
    // NOTA: Verifica que en tu frontend ordenes.service.js exista un método llamado 'cancelar' o 'anular'
    mutationFn: async ({ id, motivo }) => {
      // Ajusta 'ordenesService.cancelar' al nombre exacto que tengas en tu frontend service
      return await ordenesService.cancelar(id, { motivo });
    },
    onSuccess: (data) => {
      // 1. Borramos esta orden de la memoria de React Query para evitar el error 404
      queryClient.removeQueries(['orden', ordenId]);

      // 2. Refrescamos la lista de mesas y órdenes generales
      queryClient.invalidateQueries(['ordenes']);
      queryClient.invalidateQueries(['mesas']);

      // 3. ¡MUY IMPORTANTE! Sacamos al usuario de la vista ANTES del modal
      setSearchParams({});

      // 4. Mostramos el mensaje de éxito que viene del backend
      Swal.fire({
        icon: 'success',
        title: '¡Mesa Liberada!',
        text: data?.message || 'La orden ha sido anulada correctamente.',
        timer: 2500,
        showConfirmButton: false
      });

      // Sacamos al usuario de esta vista y lo regresamos a la lista
      setSearchParams({});
    },
    onError: (error) => {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: error.response?.data?.error?.message || 'Error al anular la orden'
      });
    },
  });

  const aplicarDescuentoMutation = useMutation({
    mutationFn: async ({ ordenId, tipo, valor, total_descontado, motivo }) => {
      return await ordenesService.aplicarDescuentoGlobal(ordenId, { tipo, valor, total_descontado, motivo });
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['orden', ordenId]);
      Swal.fire({ icon: 'success', title: 'Descuento Aplicado', timer: 1500, showConfirmButton: false });
    },
    onError: (error) => {
      Swal.fire({ icon: 'error', title: 'Error', text: error.response?.data?.error?.message || 'Error al aplicar' });
    }
  });

  const handleAplicarDescuento = async () => {
    // Calculamos el subtotal actual de la orden
    const totalActual = orden.detalles?.reduce((s, d) => s + parseFloat(d.subtotal), 0) || 0;

    const { value: formValues } = await Swal.fire({
      title: 'Aplicar Descuento a la Cuenta',
      html: `
        <div style="text-align: left;">
          <p style="font-size: 14px; color: #6b7280; margin-bottom: 12px;">Subtotal actual: <strong>S/ ${totalActual.toFixed(2)}</strong></p>
          
          <label style="font-size: 13px; font-weight: bold;">Tipo de Descuento:</label>
          <select id="swal-tipo" class="swal2-input" style="width: 100%; margin: 8px 0 16px 0;">
            <option value="fijo">Monto Fijo (S/)</option>
            <option value="porcentaje">Porcentaje (%)</option>
          </select>
          
          <label style="font-size: 13px; font-weight: bold;">Valor (S/ o %):</label>
          <input id="swal-valor" type="number" step="0.50" min="0" class="swal2-input" placeholder="Ej: 10" style="width: 100%; margin: 8px 0 16px 0;">
          
          <label style="font-size: 13px; font-weight: bold;">Motivo:</label>
          <input id="swal-motivo" type="text" class="swal2-input" placeholder="Ej: Amigo del dueño, Queja..." style="width: 100%; margin: 8px 0;">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Aplicar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => {
        const tipo = document.getElementById('swal-tipo').value;
        const valor = parseFloat(document.getElementById('swal-valor').value);
        const motivo = document.getElementById('swal-motivo').value;

        if (!valor || valor <= 0) return Swal.showValidationMessage('Ingresa un valor mayor a 0');

        let total_descontado = 0;
        if (tipo === 'fijo') {
          if (valor > totalActual) return Swal.showValidationMessage('El descuento no puede ser mayor a la cuenta');
          total_descontado = valor;
        } else if (tipo === 'porcentaje') {
          if (valor > 100) return Swal.showValidationMessage('El porcentaje no puede ser mayor a 100%');
          total_descontado = (totalActual * valor) / 100;
        }

        return { tipo, valor, total_descontado, motivo };
      }
    });

    if (formValues) {
      aplicarDescuentoMutation.mutate({
        ordenId,
        ...formValues
      });
    }
  };

  const handleAnularOrden = async () => {
    const { value: formValues } = await Swal.fire({
      title: '⚠️ ¿Anular Orden?',
      html: `
        <p style="color:#ef4444; font-size:14px; margin-bottom:12px;">
          Esta acción liberará la mesa inmediatamente.
        </p>
        <input 
          id="motivo_anulacion" 
          class="swal2-input" 
          placeholder="Motivo (Ej. Error de creación)" 
          style="width: 100%; font-size:15px;"
        >
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, anular',
      cancelButtonText: 'Cancelar',
      focusConfirm: false,
      preConfirm: () => {
        return {
          motivo: document.getElementById('motivo_anulacion').value
        };
      }
    });

    if (formValues) {
      anularOrdenMutation.mutate({
        id: ordenId,
        motivo: formValues.motivo
      });
    }
  };

  const filteredProductos = productos?.filter((prod) => {
    if (prod.tipo === 'insumo') return false;
    const matchesSearch = prod.nombre.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = filterCategoria === 'todos' || prod.categoria_nombre === filterCategoria;
    return matchesSearch && matchesCategoria;
  });

  const categoriasFiltro = [
    { value: 'todos', label: 'Todos', icon: '📋' },
    { value: 'Entradas', label: 'Entradas', icon: '🥗' },
    { value: 'Platos de Fondo', label: 'Platos', icon: '🍛' },
    { value: 'Platos a la carta', label: 'A la Carta', icon: '🍽️' },
    { value: 'Caldos', label: 'Caldos', icon: '🍲' },
    { value: 'Bebidas', label: 'Bebidas', icon: '🥤' },
    { value: 'Snacks', label: 'Snacks', icon: '🍿' },
    { value: 'Postres', label: 'Postres', icon: '🍰' },
  ];

  const agregarAlCarritoIndividual = (producto) => {
    setSelectedProductos((prev) => {
      const existing = prev.find(p => p.producto_id === producto.id && !p.es_menu);
      if (existing) {
        return prev.map(p => p.producto_id === producto.id && !p.es_menu ? { ...p, cantidad: p.cantidad + 1 } : p);
      }
      return [...prev, {
        producto_id: producto.id,
        cantidad: 1,
        precio: producto.precio_venta,
        es_menu: false,
        entrada_incluida: null,
        fondo_incluido: null,
      }];
    });
  };

  const handleAgregarProducto = (producto) => {
    if (producto.categoria_nombre === 'Entradas' || producto.categoria_nombre === 'Platos de Fondo') {
      Swal.fire({
        title: '¿Armar Menú del Día?',
        text: `Has seleccionado "${producto.nombre}". ¿Deseas armar un menú en combo o vender este plato individualmente?`,
        icon: 'question',
        showCancelButton: true,
        showDenyButton: true,
        confirmButtonColor: '#9333ea',
        denyButtonColor: '#2563eb',
        confirmButtonText: '🍽️ Armar Combo Menú',
        denyButtonText: '🛒 Vender Individual',
        cancelButtonText: 'Cancelar'
      }).then((result) => {
        if (result.isConfirmed) {
          setFilterCategoria('menu');
          if (producto.categoria_nombre === 'Entradas') {
            setMenuSeleccion({ entrada: producto, fondo: null });
          } else {
            setMenuSeleccion({ entrada: null, fondo: producto });
          }
          setShowMenuModal(true);
        } else if (result.isDenied) {
          agregarAlCarritoIndividual(producto);
        }
      });
      return;
    }
    agregarAlCarritoIndividual(producto);
  };

  const handleRemoverProducto = (productoId) => {
    setSelectedProductos((prev) => prev.filter(p => p.producto_id !== productoId));
  };

  const handleActualizarCantidad = (productoId, nuevaCantidad) => {
    if (nuevaCantidad < 1) {
      handleRemoverProducto(productoId);
      return;
    }
    setSelectedProductos((prev) => prev.map(p =>
      p.producto_id === productoId ? { ...p, cantidad: nuevaCantidad } : p
    ));
  };

  const handleGuardarOrden = () => {
    if (selectedProductos.length === 0) {
      Swal.fire({ icon: 'warning', title: 'Sin productos', text: 'Agrega al menos un producto' });
      return;
    }
    agregarDetalleMutation.mutate(selectedProductos);
  };

  const handleEliminarDetalle = async (detalleId) => {
    const result = await Swal.fire({
      title: '¿Eliminar producto?',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#ef4444',
      cancelButtonColor: '#6b7280',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
    });
    if (result.isConfirmed) {
      eliminarDetalleMutation.mutate({ ordenId, detalleId });
    }
  };

  // Función que se ejecuta al darle clic al botón
  const handleCortesia = async (detalleId) => {
    const { value: motivo } = await Swal.fire({
      title: 'Anular Plato (Cortesía)',
      text: 'El plato se mantendrá en el registro con valor S/ 0.00. Ingresa el motivo:',
      input: 'text',
      inputPlaceholder: 'Ej: Mosca en la sopa, pollo crudo, cliente canceló...',
      showCancelButton: true,
      confirmButtonColor: '#f97316',
      confirmButtonText: 'Anular Plato',
      cancelButtonText: 'Cancelar'
    });

    if (motivo) {
      aplicarCortesiaMutation.mutate({ ordenId, detalleId, motivo });
    }
  };

  const handleEnviarCocina = () => {
    const pendientes = orden?.detalles?.filter(d => !d.enviado_cocina) || [];
    if (pendientes.length === 0) {
      Swal.fire({ icon: 'info', title: 'Sin pendientes', text: 'Todos los items ya fueron enviados' });
      return;
    }
    enviarCocinaMutation.mutate(observaciones);
  };

  const handleCobrar = async () => {
    if (!orden?.detalles?.length) {
      Swal.fire({ icon: 'warning', title: 'Orden vacía', text: 'No hay productos para cobrar' });
      return;
    }
    const { value: formValues } = await Swal.fire({
      title: 'Cobrar Orden',
      html: `
        <div style="text-align: left;">
          <p><strong>Total:</strong> S/ ${orden.detalles.reduce((s, d) => s + parseFloat(d.subtotal), 0).toFixed(2)}</p>
          <label>Método de pago:</label>
          <select id="metodo_pago" class="swal2-input" style="width: 100%; margin: 8px 0;">
            <option value="efectivo">Efectivo</option>
            <option value="tarjeta">Tarjeta</option>
            <option value="yape">Yape/Plin</option>
          </select>
          <label>N° Comprobante (opcional):</label>
          <input id="numero_comprobante" class="swal2-input" placeholder="B001-000123" style="width: 100%;">
        </div>
      `,
      focusConfirm: false,
      showCancelButton: true,
      confirmButtonText: 'Cobrar',
      cancelButtonText: 'Cancelar',
      preConfirm: () => ({
        metodo_pago: document.getElementById('metodo_pago').value,
        numero_comprobante: document.getElementById('numero_comprobante').value,
      }),
    });
    if (formValues) {
      const total = orden.detalles.reduce((sum, d) => sum + parseFloat(d.subtotal), 0);
      cerrarOrdenMutation.mutate({ total, metodo_pago: formValues.metodo_pago, numero_comprobante: formValues.numero_comprobante });
    }
  };

  const handleSeleccionarEntrada = (producto) => setMenuSeleccion(prev => ({ ...prev, entrada: producto }));
  const handleSeleccionarFondo = (producto) => setMenuSeleccion(prev => ({ ...prev, fondo: producto }));

  const handleAgregarMenu = () => {
    if (!menuSeleccion.entrada || !menuSeleccion.fondo) {
      Swal.fire({ icon: 'warning', title: 'Selecciona ambos', text: 'Elige una entrada y un plato de fondo' });
      return;
    }
    setSelectedProductos(prev => [...prev, {
      producto_id: menuSeleccion.fondo.id,
      cantidad: 1,
      precio: menuSeleccion.fondo.precio_venta,
      es_menu: true,
      entrada_incluida: { id: menuSeleccion.entrada.id, nombre: menuSeleccion.entrada.nombre },
      fondo_incluido: { id: menuSeleccion.fondo.id, nombre: menuSeleccion.fondo.nombre },
    }]);
    setShowMenuModal(false);
    setMenuSeleccion({ entrada: null, fondo: null });
    Swal.fire({ icon: 'success', title: 'Menú agregado', timer: 1500, showConfirmButton: false });
  };

  const totalCarrito = selectedProductos.reduce((sum, p) => sum + parseFloat(p.precio) * p.cantidad, 0);

  // ✅ IMPRESIÓN COCINA CON NOMBRE CLIENTE
  const imprimirTicketCocina = (orden, detalles) => {
    const esLlevar = !orden.mesa_id;
    const contenido = `
══════════════════════════════════
${esLlevar ? `🛍️ PARA LLEVAR: ${orden.nombre_cliente || 'SIN NOMBRE'}` : `🍳 COCINA - Mesa ${orden.mesa_numero}`}
#${orden.numero_comanda} - ${new Date().toLocaleTimeString()}
──────────────────────────────────
${detalles.map(d => {
      let linea = `${d.cantidad}x ${d.es_menu ? 'MENÚ: ' : ''}${d.producto_nombre}`;
      if (d.es_menu && d.entrada_incluida) linea += `\n   → Entrada: ${d.entrada_incluida.nombre}`;
      if (d.observaciones && d.observaciones.trim() !== "") linea += `\n   ⚠️ NOTA: ${d.observaciones.toUpperCase()}`;
      return linea;
    }).join('\n──────────────────────────────────\n')}
    `.trim();

    console.log('🖨️ TICKET COCINA:\n', contenido);
    Swal.fire({
      title: '🖨️ Ticket Enviado a Cocina',
      html: `<pre style="text-align:left;font-family:monospace;font-size:14px;background:#fdfdfd;padding:10px;border:1px solid #eee;">${contenido}</pre>`,
      confirmButtonText: 'Entendido',
      confirmButtonColor: '#16a34a'
    });
  };

  // ✅ IMPRESIÓN CAJA CON NOMBRE CLIENTE (MANTENIENDO IGV)
  const imprimirComprobanteCaja = (orden) => {
    const total = orden.detalles.reduce((s, d) => s + parseFloat(d.subtotal), 0);
    const igv = total * 0.18;
    const subtotal = total - igv;
    const contenido = `
══════════════════════════
   RESTAURANTE XYZ
   RUC: 20123456789
══════════════════════════
Comanda #${orden.numero_comanda}
${orden.nombre_cliente ? `Cliente: ${orden.nombre_cliente}` : `Mesa: ${orden.mesa_numero}`}
Fecha: ${new Date().toLocaleString()}
──────────────────────────
${orden.detalles.map(d =>
      `${d.cantidad}x ${d.es_menu ? 'MENÚ - ' : ''}${d.producto_nombre}${d.es_menu && d.entrada_incluida ? ` (incluye ${d.entrada_incluida.nombre})` : ''}\n   S/ ${parseFloat(d.subtotal).toFixed(2)}`
    ).join('\n')}
──────────────────────────
SUBTOTAL:    S/ ${subtotal.toFixed(2)}
IGV (18%):   S/ ${igv.toFixed(2)}
TOTAL:       S/ ${total.toFixed(2)}
══════════════════════════
    `.trim();
    console.log('🖨️ COMPROBANTE CAJA:\n', contenido);
    Swal.fire({ title: '🧾 Comprobante', html: `<pre style="text-align:left;font-family:monospace;font-size:12px;">${contenido}</pre>`, confirmButtonText: 'Imprimido' });
  };

  const handleUpdateObservacion = (detalleId, texto) => {
    setObservaciones(prev => ({ ...prev, [detalleId]: texto }));
  };

  // ========================================
  // RENDERIZADO
  // ========================================

  if (ordenLoading || ordenesLoading || productosLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // ── VISTA: Lista de órdenes ──
  if (!ordenId) {
    return (
      <div className="space-y-4">

        {/* ── HEADER MÓVIL ── */}
        <div className="md:hidden">
          <div className="flex items-center justify-between mb-1">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
              <p className="text-gray-500 text-sm">Gestión de órdenes activas</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/historial-pedidos')}
                className="flex items-center gap-1 text-gray-500 border border-gray-300 bg-white text-sm font-medium px-2.5 py-2 rounded-xl"
              >
                <History className="h-4 w-4" />
              </button>
              <button
                onClick={() => crearOrdenMutation.mutate('llevar')}
                disabled={crearOrdenMutation?.isPending}
                className="flex items-center gap-1.5 bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white text-sm font-semibold px-3 py-2.5 rounded-xl shadow-md transition-all"
              >
                <Plus className="h-4 w-4" />
                Para Llevar
              </button>
            </div>
          </div>
        </div>

        {/* ── HEADER DESKTOP ── */}
        <div className="hidden md:flex md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
            <p className="text-gray-500 mt-1">Gestión de órdenes activas</p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => navigate('/historial-pedidos')}
              className="border-gray-300 text-gray-600 hover:text-gray-900"
            >
              <History className="h-4 w-4 mr-2" />
              Historial
            </Button>
            <Button
              onClick={() => crearOrdenMutation.mutate('llevar')}
              disabled={crearOrdenMutation?.isPending}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="h-5 w-5 mr-2" />
              Para Llevar
            </Button>
          </div>
        </div>

        {/* ── LISTA VACÍA ── */}
        {ordenes?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Receipt className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-gray-900 mb-2">No hay órdenes activas</h2>
              <p className="text-gray-500 mb-6">Crea una orden desde el módulo de Mesas o inicia un pedido rápido.</p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => navigate('/mesas')}>Ir a Mesas</Button>
                <Button className="bg-orange-600 hover:bg-orange-700 text-white" onClick={() => crearOrdenMutation.mutate('llevar')}>
                  Nuevo Para Llevar
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* ── TARJETAS DESKTOP ── */}
            <div className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {ordenes?.map((orden) => {
                const esLlevar = !orden.mesa_id;
                return (
                  <Card
                    key={orden.id}
                    className={`cursor-pointer hover:shadow-lg transition-shadow ${esLlevar ? 'border-l-4 border-l-orange-500' : ''}`}
                    onClick={() => setSearchParams({ orden_id: orden.id })}
                  >
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        {/* ✅ NOMBRE CLIENTE AQUI */}
                        <span>{esLlevar ? `🛍️ ${orden.nombre_cliente || 'Para Llevar'}` : `Orden #${orden.numero_comanda?.split('-')[2] || orden.id}`}</span>
                        <Badge variant={esLlevar ? 'outline' : 'default'} className={esLlevar ? 'border-orange-500 text-orange-600' : ''}>
                          {orden.estado}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">{esLlevar ? 'Cliente:' : 'Mesa:'}</span>
                        {/* ✅ NOMBRE CLIENTE AQUI */}
                        <span className="font-semibold">{esLlevar ? (orden.nombre_cliente || 'Para Llevar') : orden.mesa_numero}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Mesero:</span>
                        <span className="font-semibold">{orden.mesero_nombre}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Productos:</span>
                        <span className="font-semibold">{orden.detalles?.length || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-500">Total:</span>
                        <span className="font-bold text-blue-600">S/ {orden.total_real ? parseFloat(orden.total_real).toFixed(2) : '0.00'}</span>
                      </div>
                      <Button className="w-full mt-4" variant={esLlevar ? 'outline' : 'default'}>Ver Detalle</Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* ── TARJETAS MÓVIL ── */}
            <div className="flex flex-col gap-3 md:hidden">
              {ordenes?.map((orden) => {
                const esLlevar = !orden.mesa_id;
                return (
                  <div
                    key={orden.id}
                    onClick={() => setSearchParams({ orden_id: orden.id })}
                    className={`bg-white rounded-2xl shadow-sm border active:scale-[0.98] transition-transform cursor-pointer overflow-hidden
                      ${esLlevar ? 'border-l-4 border-l-orange-400' : 'border-l-4 border-l-blue-500'}`}
                  >
                    <div className={`px-4 pt-3 pb-2 flex items-center justify-between ${esLlevar ? 'bg-orange-50' : 'bg-blue-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{esLlevar ? '🛍️' : '🍽️'}</span>
                        <div>
                          {/* ✅ NOMBRE CLIENTE AQUI */}
                          <p className={`font-bold text-[15px] ${esLlevar ? 'text-orange-700' : 'text-blue-700'}`}>
                            {esLlevar ? (orden.nombre_cliente || 'Para Llevar') : `Orden #${orden.numero_comanda?.split('-')[2] || orden.id}`}
                          </p>
                          {!esLlevar ? (
                            <p className="text-[11px] text-blue-500">Mesa {orden.mesa_numero}</p>
                          ) : (
                            <p className="text-[11px] text-orange-500">#{orden.numero_comanda?.split('-')[2]} · Llevar</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full
                        ${esLlevar ? 'bg-orange-100 text-orange-700 border border-orange-200' : 'bg-blue-100 text-blue-700 border border-blue-200'}`}>
                        {orden.estado}
                      </span>
                    </div>

                    <div className="px-4 py-3 flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-[12px] text-gray-500">
                          Mesero: <span className="font-semibold text-gray-800">{orden.mesero_nombre}</span>
                        </p>
                        <p className="text-[12px] text-gray-500">
                          Productos: <span className="font-semibold text-gray-800">{orden.detalles?.length || 0}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className="text-[11px] text-gray-400">Total</p>
                          <p className="text-[16px] font-bold text-blue-600">
                            S/ {orden.total_real ? parseFloat(orden.total_real).toFixed(2) : '0.00'}
                          </p>
                        </div>
                        <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${esLlevar ? 'bg-orange-500' : 'bg-blue-600'}`}>
                          <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  }

  // ── VISTA: Orden no encontrada ──
  if (!orden) {
    return (
      <div className="space-y-6">
        <Button variant="outline" onClick={() => setSearchParams({})}>
          <ArrowLeft className="h-5 w-5 mr-2" /> Volver
        </Button>
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Orden no encontrada</h2>
            <Button onClick={() => setSearchParams({})}>Volver a la lista</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── HEADER ── */}
      <div className="md:flex md:items-center md:justify-between md:gap-4">
        {/* Móvil */}
        <div className="md:hidden bg-[#1e3a5f] -mx-4 -mt-4 px-4 pt-4 pb-3 mb-4">
          <div className="flex items-center justify-between mb-1">
            <button onClick={() => setSearchParams({})} className="flex items-center gap-1 text-blue-300 text-sm">
              <ArrowLeft className="h-4 w-4" /> Volver
            </button>
            <Badge className="bg-green-500 text-white text-[10px] px-2 py-0.5">{orden.estado.toUpperCase()}</Badge>
          </div>
          <h1 className="text-white font-semibold text-base">
            {/* ✅ NOMBRE CLIENTE AQUI */}
            {orden.mesa_id ? `Mesa ${orden.mesa_numero}` : `🛍️ CLIENTE: ${orden.nombre_cliente || 'Llevar'}`} — Comanda #{orden.numero_comanda?.split('-')[2] || orden.id}
          </h1>
          <p className="text-blue-300 text-xs mb-2">Mesero: {orden.mesero_nombre}</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Comanda', value: `#${orden.numero_comanda?.split('-')[2] || orden.id}` },
              { label: orden.mesa_id ? 'Mesa' : 'Cliente', value: orden.mesa_id ? orden.mesa_numero : (orden.nombre_cliente || 'Para Llevar') },
              { label: 'Estado', value: orden.estado },
            ].map(({ label, value }) => (
              <div key={label} className="bg-white/10 rounded-lg px-2 py-1.5">
                <p className="text-blue-300 text-[10px]">{label}</p>
                <p className="text-white text-[13px] font-medium capitalize truncate">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Desktop */}
        <div className="hidden md:block">
          <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500 mt-1">
            {/* ✅ NOMBRE CLIENTE AQUI */}
            Orden #{orden.numero_comanda?.split('-')[2] || orden.id} - {orden.mesa_id ? `Mesa ${orden.mesa_numero}` : `🛍️ CLIENTE: ${orden.nombre_cliente || 'Para Llevar'}`}
          </p>
        </div>
        <div className="hidden md:flex gap-2">
          <Badge variant={orden.estado === 'abierta' ? 'default' : 'secondary'} className="text-sm">
            {orden.estado.toUpperCase()}
          </Badge>
          {isAdminOCajero && orden.estado !== 'cobrada' && orden.estado !== 'cancelada' && (
            <Button
              variant="destructive"
              onClick={handleAnularOrden}
              disabled={anularOrdenMutation.isPending}
              className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border-none shadow-none font-medium"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {anularOrdenMutation.isPending ? 'Anulando...' : 'Anular Orden'}
            </Button>
          )}
          <Button variant="outline" onClick={() => setSearchParams({})}>
            <ArrowLeft className="h-5 w-5 mr-2" /> Volver
          </Button>
        </div>
      </div>

      {/* ── INFO ORDEN (solo desktop) ── */}
      <Card className="hidden md:block">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div><p className="text-sm text-gray-500">Comanda</p><p className="font-semibold">{orden.numero_comanda}</p></div>
            {/* ✅ NOMBRE CLIENTE AQUI */}
            <div><p className="text-sm text-gray-500">{orden.mesa_id ? 'Mesa' : 'Cliente'}</p><p className="font-semibold">{orden.mesa_numero || (orden.nombre_cliente || 'Para Llevar')}</p></div>
            <div><p className="text-sm text-gray-500">Mesero</p><p className="font-semibold">{orden.mesero_nombre}</p></div>
            <div><p className="text-sm text-gray-500">Estado</p><p className="font-semibold capitalize">{orden.estado}</p></div>
          </div>
        </CardContent>
      </Card>

      {/* ── AGREGAR PRODUCTOS (Desktop) ── */}
      <div className="hidden md:grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader><CardTitle>Agregar Productos</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {categoriasFiltro.map((cat) => (
                <Button key={cat.value} variant={filterCategoria === cat.value ? 'default' : 'outline'} size="sm"
                  onClick={() => setFilterCategoria(cat.value)} className="text-sm">
                  {cat.icon} {cat.label}
                </Button>
              ))}
              <Button variant={filterCategoria === 'menu' ? 'default' : 'outline'} size="sm"
                onClick={() => { setFilterCategoria('menu'); setShowMenuModal(true); }}
                className="text-sm bg-purple-600 hover:bg-purple-700">
                🍽️ Menú del Día
              </Button>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
              {filterCategoria === 'menu' ? (
                <div className="col-span-full text-center py-8 text-gray-500">
                  Click en "🍽️ Menú del Día" para armar tu combo
                </div>
              ) : filteredProductos?.map((producto) => (
                <button key={producto.id} onClick={() => handleAgregarProducto(producto)}
                  className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 hover:shadow-md transition-all text-left">
                  <h3 className="font-semibold text-gray-900">{producto.nombre}</h3>
                  <p className="text-sm text-gray-500">{producto.categoria_nombre}</p>
                  <p className="text-lg font-bold text-blue-600 mt-2">S/ {producto.precio_venta.toFixed(2)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ChefHat className="h-5 w-5 text-green-600" /> Productos Agregados
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {selectedProductos.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No hay productos agregados</p>
            ) : (
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {selectedProductos.map((item) => {
                  const producto = productos?.find(p => p.id === item.producto_id);
                  return (
                    <div key={item.producto_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-gray-900">{producto?.nombre}</p>
                          {item.es_menu && <Badge className="bg-purple-600 text-white">MENÚ</Badge>}
                        </div>
                        {item.es_menu && item.entrada_incluida && (
                          <p className="text-xs text-purple-600 mt-1">Incluye: {item.entrada_incluida.nombre}</p>
                        )}
                        <p className="text-sm text-gray-500">S/ {parseFloat(item.precio).toFixed(2)} x {item.cantidad}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad - 1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">-</button>
                        <span className="w-8 text-center font-semibold">{item.cantidad}</span>
                        <button onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad + 1)}
                          className="w-8 h-8 rounded-full bg-gray-200 hover:bg-gray-300 flex items-center justify-center">+</button>
                        <button onClick={() => handleRemoverProducto(item.producto_id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {selectedProductos.length > 0 && (
              <div className="border-t pt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-lg font-semibold">Total:</span>
                  <span className="text-2xl font-bold text-blue-600">S/ {totalCarrito.toFixed(2)}</span>
                </div>
                <Button onClick={handleGuardarOrden} disabled={agregarDetalleMutation.isPending}
                  className="w-full bg-blue-600 hover:bg-blue-700">
                  <Plus className="h-5 w-5 mr-2" />
                  {agregarDetalleMutation.isPending ? 'Agregando...' : 'Agregar a la Orden'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── AGREGAR PRODUCTOS (Móvil) ── */}
      <div className="md:hidden space-y-2">
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {categoriasFiltro.map((cat) => (
            <button key={cat.value} onClick={() => setFilterCategoria(cat.value)}
              className={`flex-shrink-0 px-3 py-1 rounded-full text-xs border transition-all ${filterCategoria === cat.value
                ? 'bg-[#1e3a5f] text-white border-[#1e3a5f]'
                : 'bg-white text-gray-600 border-gray-200'
                }`}>
              {cat.icon} {cat.label}
            </button>
          ))}
          <button onClick={() => { setFilterCategoria('menu'); setShowMenuModal(true); }}
            className="flex-shrink-0 px-3 py-1 rounded-full text-xs bg-purple-600 text-white border border-purple-600">
            🍽️ Menú del Día
          </button>
        </div>

        <div className="flex items-center gap-2 bg-gray-100 rounded-lg px-3 py-2">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <input className="bg-transparent text-sm flex-1 outline-none text-gray-700 placeholder-gray-400"
            placeholder="Buscar producto..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>

        {filterCategoria !== 'menu' && (
          <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto">
            {filteredProductos?.map((producto) => (
              <button key={producto.id} onClick={() => handleAgregarProducto(producto)}
                className="p-3 border border-gray-200 rounded-xl bg-white text-left active:scale-95 transition-transform">
                <p className="font-medium text-[13px] text-gray-900 leading-tight mb-1">{producto.nombre}</p>
                <p className="text-[11px] text-gray-400 mb-2">{producto.categoria_nombre}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[14px] font-semibold text-blue-700">S/ {producto.precio_venta.toFixed(2)}</span>
                  <span className="w-6 h-6 rounded-md bg-[#1e3a5f] flex items-center justify-center">
                    <Plus className="h-3.5 w-3.5 text-white" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {selectedProductos.length > 0 && (
          <div className="border border-green-200 rounded-xl overflow-hidden">
            <div className="bg-white divide-y divide-gray-100">
              {selectedProductos.map((item) => {
                const producto = productos?.find(p => p.id === item.producto_id);
                return (
                  <div key={item.producto_id} className="flex items-center gap-2 px-3 py-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-gray-900 truncate">{producto?.nombre}</p>
                      {item.es_menu && item.entrada_incluida && (
                        <p className="text-[11px] text-purple-600">Incluye: {item.entrada_incluida.nombre}</p>
                      )}
                      <p className="text-[12px] text-gray-500">S/ {parseFloat(item.precio).toFixed(2)}</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad - 1)}
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium">-</button>
                      <span className="w-6 text-center text-sm font-semibold">{item.cantidad}</span>
                      <button onClick={() => handleActualizarCantidad(item.producto_id, item.cantidad + 1)}
                        className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-700 font-medium">+</button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[13px] font-semibold text-gray-900 min-w-[52px] text-right">
                        S/ {(parseFloat(item.precio) * item.cantidad).toFixed(2)}
                      </span>
                      <button onClick={() => handleRemoverProducto(item.producto_id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-green-50 px-3 py-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-green-700 text-white text-[11px] font-medium px-2 py-0.5 rounded-full">
                  {selectedProductos.reduce((s, p) => s + p.cantidad, 0)} items
                </span>
                <span className="text-blue-700 font-semibold text-sm">S/ {totalCarrito.toFixed(2)}</span>
              </div>
              <button onClick={handleGuardarOrden} disabled={agregarDetalleMutation.isPending}
                className="bg-green-700 text-white text-xs font-medium px-4 py-2 rounded-lg">
                {agregarDetalleMutation.isPending ? '...' : 'Agregar a la orden'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── DETALLES DE LA ORDEN ── */}
      {orden.detalles?.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Productos en la Orden</CardTitle></CardHeader>
          <CardContent>

            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="border-b border-gray-100 text-gray-500">
                  <tr>
                    <th className="font-medium py-3 px-4">Producto</th>
                    <th className="text-center font-medium py-3 px-2">Cant.</th>
                    <th className="text-right font-medium py-3 px-4">Precio</th>
                    <th className="text-right font-medium py-3 px-4">Subtotal</th>
                    <th className="text-center font-medium py-3 px-4">Cocina</th>
                    <th className="text-center font-medium py-3 px-4">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {orden.detalles.map((detalle) => (
                    <tr key={detalle.id} className="border-b hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex flex-col">
                          <span className="font-medium">
                            {detalle.es_menu ? `MENÚ: ${detalle.producto_nombre}` : detalle.producto_nombre}
                          </span>
                          {detalle.es_menu && detalle.entrada_incluida && (
                            <span className="block text-xs text-purple-600">→ {detalle.entrada_incluida.nombre}</span>
                          )}
                          {!detalle.enviado_cocina ? (
                            <input type="text" placeholder="Nota (ej. sin ají, pierna...)"
                              className="mt-1 w-full text-[11px] p-1 border-b border-blue-200 bg-blue-50/30 focus:bg-white outline-none italic rounded"
                              value={observaciones[detalle.id] || ''}
                              onChange={(e) => handleUpdateObservacion(detalle.id, e.target.value)} />
                          ) : (
                            detalle.observaciones && (
                              <span className="text-[10px] text-orange-600 font-bold mt-1 uppercase italic">
                                📝 NOTA: {detalle.observaciones}
                              </span>
                            )
                          )}
                        </div>
                      </td>
                      <td className="text-center py-3 px-2">{detalle.cantidad}</td>
                      <td className="text-right py-3 px-4">S/ {parseFloat(detalle.precio || 0).toFixed(2)}</td>
                      <td className="text-right py-3 px-4 font-semibold">S/ {parseFloat(detalle.subtotal || 0).toFixed(2)}</td>
                      <td className="text-center py-3 px-4">
                        <Badge variant={detalle.enviado_cocina ? 'default' : 'secondary'} className="whitespace-nowrap text-[10px]">
                          {detalle.enviado_cocina ? '✅ Enviado' : '⏳ Pendiente'}
                        </Badge>
                      </td>
                      <td className="text-center py-3 px-4">
                        {!detalle.enviado_cocina && (
                          <button onClick={() => handleEliminarDetalle(detalle.id)}
                            disabled={eliminarDetalleMutation.isPending}
                            className="p-2 text-red-600 hover:bg-red-50 rounded">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleCortesia(detalle.id)}
                          disabled={aplicarCortesiaMutation?.isPending}
                          title="Aplicar cortesía"
                          className="p-2 text-green-600 hover:bg-green-50 rounded">
                          <Gift className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Móvil */}
            <div className="flex flex-col gap-2 md:hidden">
              {orden.detalles.map((detalle) => (
                <div key={detalle.id} className="bg-white border border-gray-100 rounded-xl px-3 py-2.5">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex-1">
                      <p className="text-[13px] font-medium text-gray-900 leading-tight">
                        {detalle.es_menu ? `MENÚ: ${detalle.producto_nombre}` : detalle.producto_nombre}
                      </p>
                      {!detalle.enviado_cocina ? (
                        <input type="text" placeholder="Nota especial..."
                          className="mt-1 w-full text-[11px] p-1.5 border border-blue-100 bg-blue-50/50 rounded-lg outline-none italic"
                          value={observaciones[detalle.id] || ''}
                          onChange={(e) => handleUpdateObservacion(detalle.id, e.target.value)} />
                      ) : (
                        detalle.observaciones && (
                          <p className="text-[10px] text-orange-600 font-bold mt-1 italic uppercase">
                            📝 {detalle.observaciones}
                          </p>
                        )
                      )}
                    </div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full whitespace-nowrap flex-shrink-0 ${detalle.enviado_cocina ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'}`}>
                      {detalle.enviado_cocina ? '✅ Enviado' : '⏳ Pendiente'}
                    </span>
                  </div>
                  {detalle.es_menu && detalle.entrada_incluida && (
                    <p className="text-[11px] text-purple-600 mb-1.5">→ {detalle.entrada_incluida.nombre}</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-gray-500">
                      Cant: <span className="font-medium text-gray-800">{detalle.cantidad}</span>
                      {' · '}S/ {parseFloat(detalle.precio || 0).toFixed(2)}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-semibold text-gray-900">
                        S/ {parseFloat(detalle.subtotal || 0).toFixed(2)}
                      </span>
                      {!detalle.enviado_cocina && (
                        <button onClick={() => handleEliminarDetalle(detalle.id)}
                          disabled={eliminarDetalleMutation.isPending}
                          className="p-1 text-red-500 hover:bg-red-50 rounded-lg">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleCortesia(detalle.id)}
                        disabled={aplicarCortesiaMutation?.isPending}
                        className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg">
                        <Gift className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

          </CardContent>
        </Card>
      )}

      {/* ── SECCIÓN DE TOTALES Y ACCIONES DE LA ORDEN ── */}
      <div className="mt-8 border-t border-gray-200 pt-6 flex flex-col md:flex-row justify-between items-end md:items-center gap-4">

        {/* 1. ZONA DE TOTALES (Siempre visible) */}
        <div className="text-right md:text-left w-full md:w-auto">
          <span className="text-gray-500 text-sm block">
            Subtotal: S/ {orden.detalles?.reduce((acc, d) => acc + parseFloat(d.subtotal || 0), 0).toFixed(2)}
          </span>

          {/* Muestra el descuento si es mayor a 0 */}
          {parseFloat(orden.descuento_total) > 0 && (
            <span className="text-orange-500 text-sm font-medium block">
              Descuento: - S/ {parseFloat(orden.descuento_total).toFixed(2)}
            </span>
          )}

          <span className="text-2xl font-bold text-gray-800 block mt-1">
            TOTAL: S/ {(
              orden.detalles?.reduce((acc, d) => acc + parseFloat(d.subtotal || 0), 0) -
              parseFloat(orden.descuento_total || 0)
            ).toFixed(2)}
          </span>
        </div>

        {/* 2. ZONA DE BOTONES */}
        <div className="flex flex-wrap items-center justify-end gap-3 w-full md:w-auto">

          {/* 👇 NUEVO BOTÓN: Aplicar Descuento (Visible para Admin/Cajero) 👇 */}
          {isAdminOCajero && (
            <Button
              onClick={handleAplicarDescuento}
              variant="outline"
              className="w-full md:w-auto bg-orange-50 text-orange-600 border-orange-200 hover:bg-orange-100 hover:text-orange-700"
            >
              <DollarSign className="w-4 h-4 mr-2" />
              Aplicar Descuento
            </Button>
          )}

          {/* 👇 TU BOTÓN ORIGINAL: Enviar a Cocina (Condicionado) 👇 */}
          {orden.estado === 'abierta' && orden.detalles?.some(d => !d.enviado_cocina) && (
            <Button
              onClick={handleEnviarCocina}
              disabled={enviarCocinaMutation.isPending}
              className="w-full md:w-auto bg-green-600 hover:bg-green-700"
            >
              <Send className="h-4 w-4 mr-2" />
              {enviarCocinaMutation.isPending
                ? 'Enviando...'
                : `Enviar a Cocina (${orden.detalles.filter(d => !d.enviado_cocina).length} pdtes)`
              }
            </Button>
          )}

        </div>
      </div>

      {/* ── MODAL MENÚ DEL DÍA ── */}
      <Dialog open={showMenuModal} onOpenChange={setShowMenuModal}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>🍽️ Armar Menú del Día</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-4">
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><span className="text-lg">🥗</span> Entradas Disponibles</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {productosMenu?.filter(p => p.categoria_nombre === 'Entradas').map((prod) => (
                  <button key={prod.id} onClick={() => handleSeleccionarEntrada(prod)}
                    className={`w-full p-3 text-left border rounded-lg transition-all ${menuSeleccion.entrada?.id === prod.id
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{prod.nombre}</span>
                      {menuSeleccion.entrada?.id === prod.id && <Badge className="bg-purple-600">✓</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-3 flex items-center gap-2"><span className="text-lg">🍛</span> Platos de Fondo Disponibles</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {productosMenu?.filter(p => p.categoria_nombre === 'Platos de Fondo').map((prod) => (
                  <button key={prod.id} onClick={() => handleSeleccionarFondo(prod)}
                    className={`w-full p-3 text-left border rounded-lg transition-all ${menuSeleccion.fondo?.id === prod.id
                      ? 'border-purple-500 bg-purple-50 ring-2 ring-purple-200'
                      : 'border-gray-200 hover:border-purple-300'}`}>
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{prod.nombre}</span>
                      <span className="font-bold text-blue-600">S/ {prod.precio_venta.toFixed(2)}</span>
                      {menuSeleccion.fondo?.id === prod.id && <Badge className="bg-purple-600">✓</Badge>}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
          {menuSeleccion.entrada && menuSeleccion.fondo && (
            <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
              <p className="font-medium text-purple-900">Menú: {menuSeleccion.entrada.nombre} + {menuSeleccion.fondo.nombre}</p>
              <p className="text-sm text-purple-700">Precio: S/ {menuSeleccion.fondo.precio_venta.toFixed(2)} (entrada incluida)</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowMenuModal(false); setMenuSeleccion({ entrada: null, fondo: null }); }}>
              Cancelar
            </Button>
            <Button onClick={handleAgregarMenu} disabled={!menuSeleccion.entrada || !menuSeleccion.fondo} className="bg-purple-600 hover:bg-purple-700">
              Agregar Menú
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};