const catchAsync = require('../utils/catchAsync');
const ordenesService = require('../services/ordenes.service');
const AppError = require('../utils/AppError');

const getAll = catchAsync(async (req, res) => {
    const ordenes = await ordenesService.getAllOrdenes(req.query);
    res.json({ success: true, data: { ordenes } });
});

const getById = catchAsync(async (req, res) => {
    const orden = await ordenesService.getOrdenById(req.params.id);
    res.json({ success: true, data: { orden } });
});

const getActivaPorMesa = catchAsync(async (req, res) => {
    const orden = await ordenesService.getOrdenActivaPorMesa(req.params.mesa_id);

    if (!orden) {
        return res.status(404).json({
            success: false,
            error: { message: 'No hay orden activa para esta mesa' },
        });
    }

    res.json({ success: true, data: { orden } });
});

const create = catchAsync(async (req, res) => {
    const orden = await ordenesService.createOrden(req.body, req.user.id);
    res.status(201).json({ success: true, data: { orden } });
});

const agregarDetalles = catchAsync(async (req, res) => {
    const { detalles } = req.body;

    if (!detalles || !Array.isArray(detalles)) {
        throw AppError.badRequest('El campo "detalles" debe ser un array');
    }

    const detallesInsertados = await ordenesService.agregarDetalleOrden(
        req.params.id,
        detalles,
        req.user.id
    );

    res.status(201).json({ success: true, data: { detalles: detallesInsertados } });
});

const enviarCocina = catchAsync(async (req, res) => {
    // 1. Atrapamos las observaciones que vienen del Frontend (React)
    const { observaciones } = req.body;

    // 2. Le pasamos las observaciones al servicio (Añadí el tercer parámetro)
    const resultado = await ordenesService.enviarACocina(
        req.params.id,
        req.user.id,
        observaciones
    );

    res.json({
        success: true,
        message: 'Orden enviada a cocina',
        data: {
            orden: resultado.orden,
            detalles: resultado.detalles,
            imprimir: true,  // Flag para que el frontend sepa que debe imprimir
        },
    });
});

const actualizarEstado = catchAsync(async (req, res) => {
    const { estado } = req.body;

    if (!estado) {
        throw AppError.badRequest('El estado es requerido');
    }

    const orden = await ordenesService.actualizarEstadoOrden(
        req.params.id,
        estado,
        req.user.id
    );

    res.json({ success: true, data: { orden } });
});

const cancelar = catchAsync(async (req, res) => {
    const { motivo } = req.body;

    const orden = await ordenesService.cancelarOrden(
        req.params.id,
        req.user.id,
        motivo || null
    );

    res.json({ success: true, message: 'Orden cancelada', data: { orden } });
});

// NUEVA FUNCIÓN: Obtener productos para Menú del Día
const getProductosParaMenu = catchAsync(async (req, res) => {
    const productos = await ordenesService.getProductosParaMenu();
    res.json({ success: true, data: { productos } });
});

// NUEVA FUNCIÓN: Eliminar detalle de la orden
const eliminarDetalle = catchAsync(async (req, res) => {
    const resultado = await ordenesService.eliminarDetalleOrden(
        req.params.id,
        req.params.detalleId,
        req.user.id
    );

    res.json({
        success: true,
        message: 'Producto eliminado de la orden',
        data: resultado,
    });
});

// NUEVA FUNCIÓN: Cerrar orden y cobrar
const cerrar = catchAsync(async (req, res) => {
    const { total, metodo_pago, numero_comprobante, observaciones_cierre } = req.body;

    if (!total || !metodo_pago) {
        throw AppError.badRequest('Total y método de pago son requeridos');
    }

    const orden = await ordenesService.cerrarOrden(
        req.params.id,
        {
            total,
            metodo_pago,
            numero_comprobante: numero_comprobante || null,
            observaciones_cierre: observaciones_cierre || null,
        },
        req.user.id
    );

    res.json({
        success: true,
        message: 'Orden cerrada y cobrada',
        data: {
            orden,
            imprimir: true,  // Flag para que el frontend sepa que debe imprimir comprobante
        },
    });
});

module.exports = {
    getAll,
    getById,
    getActivaPorMesa,
    create,
    agregarDetalles,
    eliminarDetalle,        // ← NUEVO
    enviarCocina,
    actualizarEstado,
    cancelar,
    getProductosParaMenu,
    cerrar,
};