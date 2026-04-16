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

// El nombre de la constante sigue siendo "cancelar" para no romper tus rutas
const cancelar = catchAsync(async (req, res) => {
    const { motivo } = req.body;

    // PERO por dentro, llama a tu nueva función del servicio
    const resultado = await ordenesService.anularOrdenYLiberarMesa(
        req.params.id,
        req.user.id,
        motivo || null
    );

    res.json(resultado);
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

const aplicarCortesiaDetalle = catchAsync(async (req, res) => {
    const { id: ordenId, detalleId: detalle_id } = req.params;

    const { motivo } = req.body;

    const resultado = await ordenesService.aplicarCortesiaDetalle(
        ordenId,
        detalle_id,
        motivo,
        req.user.id
    );

    res.json({
        success: true,
        message: 'Cortesía aplicada correctamente',
        data: resultado,
    });
});

const aplicarDescuentoGlobal = catchAsync(async (req, res) => {
    const { id: ordenId } = req.params;
    
    // 1. Ya no destructuramos "porcentaje", sacamos todo lo que manda el nuevo Frontend
    const { tipo, valor, total_descontado, motivo } = req.body;

    // 2. Agrupamos esos datos en el objeto que espera tu Servicio
    const datosDescuento = {
        tipo,
        valor,
        total_descontado,
        motivo
    };

    // 3. Llamamos a tu servicio pasándole el objeto y el ID del cajero
    const resultado = await ordenesService.aplicarDescuentoGlobal(
        ordenId,
        datosDescuento,
        req.user.id // ¡Muy bien pensado dejar esto aquí!
    );

    res.json({
        success: true,
        message: 'Descuento aplicado correctamente',
        data: resultado,
    });
});

module.exports = {
    getAll,
    getById,
    getActivaPorMesa,
    create,
    agregarDetalles,
    eliminarDetalle,
    enviarCocina,
    actualizarEstado,
    cancelar,
    getProductosParaMenu,
    cerrar,
    aplicarCortesiaDetalle,
    aplicarDescuentoGlobal,
};