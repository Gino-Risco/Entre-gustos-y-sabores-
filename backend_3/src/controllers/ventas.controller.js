const catchAsync = require('../utils/catchAsync');
const ventasService = require('../services/ventas.service');
const AppError = require('../utils/AppError');

const getAll = catchAsync(async (req, res) => {
  const ventas = await ventasService.getAllVentas(req.query);
  res.json({ success: true, data: { ventas } });
});

const getById = catchAsync(async (req, res) => {
  const venta = await ventasService.getVentaById(req.params.id);
  res.json({ success: true, data: { venta } });
});

const create = catchAsync(async (req, res) => {
  const { orden_id, metodo_pago, monto_pagado, descuento, observaciones } = req.body;

  // Validaciones básicas
  if (!orden_id || !metodo_pago || !monto_pagado) {
    throw AppError.badRequest('Orden, método de pago y monto pagado son requeridos');
  }

  const metodosValidos = ['efectivo', 'tarjeta', 'yape', 'plin', 'mixto'];
  if (!metodosValidos.includes(metodo_pago)) {
    throw AppError.badRequest(
      `Método de pago inválido. Válidos: ${metodosValidos.join(', ')}`
    );
  }

  const venta = await ventasService.crearVenta(
    { orden_id, metodo_pago, monto_pagado, descuento: descuento || 0, observaciones },
    req.user.id
  );

  res.status(201).json({
    success: true,
    message: 'Venta registrada correctamente',
    data: {
      venta,
      imprimir: true,  // Flag para que el frontend sepa que debe imprimir ticket
    },
  });
});

const anular = catchAsync(async (req, res) => {
  const { motivo } = req.body;

  if (!motivo) {
    throw AppError.badRequest('El motivo de anulación es requerido');
  }

  const result = await ventasService.anularVenta(req.params.id, req.user.id, motivo);

  res.json({
    success: true,
    message: 'Venta anulada correctamente',
    data: result,
  });
});

const getTicket = catchAsync(async (req, res) => {
  const ticketData = await ventasService.getTicketData(req.params.id);
  res.json({ success: true, data: { ticket: ticketData } });
});
// ============================================
// NUEVA FUNCIÓN: Obtener órdenes disponibles para cobrar
// ============================================
const getOrdenesPorCobrar = catchAsync(async (req, res) => {
  const { mesa_id, estado } = req.query;
  
  const ordenes = await ventasService.getOrdenesPorCobrar({
    mesa_id: mesa_id ? parseInt(mesa_id) : undefined,
    estado,
  });

  res.json({
    success: true,
    data: { ordenes },
  });
});
module.exports = {
  getAll,
  getById,
  create,
  anular,
  getTicket,
  getOrdenesPorCobrar, // Exportar nueva función
};