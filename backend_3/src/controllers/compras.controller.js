const catchAsync = require('../utils/catchAsync');
const comprasService = require('../services/compras.service');
const AppError = require('../utils/AppError');

// ==========================================
// PROVEEDORES
// ==========================================

const getAllProveedores = catchAsync(async (req, res) => {
  const proveedores = await comprasService.getAllProveedores(req.query);
  res.json({ success: true, data: { proveedores } });
});

const getProveedorById = catchAsync(async (req, res) => {
  const proveedor = await comprasService.getProveedorById(req.params.id);
  res.json({ success: true, data: { proveedor } });
});

const createProveedor = catchAsync(async (req, res) => {
  const proveedor = await comprasService.createProveedor(req.body);
  res.status(201).json({ success: true, data: { proveedor } });
});

const updateProveedor = catchAsync(async (req, res) => {
  const proveedor = await comprasService.updateProveedor(req.params.id, req.body);
  res.json({ success: true, data: { proveedor } });
});

const deleteProveedor = catchAsync(async (req, res) => {
  const result = await comprasService.deleteProveedor(req.params.id);
  res.json({ success: true, data: { result } });  // ✅ CORREGIDO: agregado data:
});

// ==========================================
// COMPRAS
// ==========================================

const getAllCompras = catchAsync(async (req, res) => {
  const compras = await comprasService.getAllCompras(req.query);
  res.json({ success: true, data: { compras } });
});

const getCompraById = catchAsync(async (req, res) => {
  const compra = await comprasService.getCompraById(req.params.id);
  res.json({ success: true, data: { compra } });
});

const createCompra = catchAsync(async (req, res) => {
  // 1. Agregamos los nuevos campos en la desestructuración
  const {
    proveedor_id,
    fecha_emision,
    tipo_comprobante,
    serie_comprobante,
    numero_comprobante,
    igv,
    detalles,
    observaciones
  } = req.body;

  if (!proveedor_id || !detalles || !Array.isArray(detalles)) {
    throw AppError.badRequest('Proveedor y detalles son requeridos');
  }

  if (detalles.length === 0) {
    throw AppError.badRequest('Debe proporcionar al menos un detalle de compra');
  }

  for (const detalle of detalles) {
    if (!detalle.producto_id || !detalle.cantidad || !detalle.costo_unitario) {
      throw AppError.badRequest('Cada detalle debe tener producto_id, cantidad y costo_unitario');
    }
  }

  // 2. Pasamos todo el objeto completo al servicio
  const compra = await comprasService.createCompra(
    {
      proveedor_id,
      fecha_emision,
      tipo_comprobante,
      serie_comprobante,
      numero_comprobante,
      igv,
      detalles,
      observaciones
    },
    req.user.id 
  );

  res.status(201).json({
    success: true,
    message: 'Compra registrada correctamente. Stock actualizado automáticamente.',
    data: { compra },
  });
});

const anularCompra = catchAsync(async (req, res) => {
  const { motivo } = req.body;

  if (!motivo) {
    throw AppError.badRequest('El motivo de anulación es requerido');
  }

  const result = await comprasService.anularCompra(req.params.id, req.user.id, motivo);

  res.json({
    success: true,
    message: 'Compra anulada correctamente. Stock revertido automáticamente.',
    data: result,
  });
});

module.exports = {
  // Proveedores
  getAllProveedores,
  getProveedorById,
  createProveedor,
  updateProveedor,
  deleteProveedor,
  // Compras
  getAllCompras,
  getCompraById,
  createCompra,
  anularCompra,
};