const { query, TABLE, getClient } = require('../config/database');
const AppError = require('../utils/AppError');

// ============================================
// NUEVA FUNCIÓN: Obtener órdenes disponibles para cobrar
// ============================================
async function getOrdenesPorCobrar(filtros = {}) {
    const { mesa_id, estado } = filtros;

    const conditions = [
        'o.activo = TRUE',
        "o.estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista')",
        'o.id NOT IN (SELECT orden_id FROM pos.ventas WHERE activo = TRUE)'
    ];
    const params = [];
    let paramIndex = 1;

    if (mesa_id) {
        conditions.push(`o.mesa_id = $${paramIndex}`);
        params.push(mesa_id);
        paramIndex++;
    }

    if (estado && ['abierta', 'enviada_cocina', 'preparando', 'lista'].includes(estado)) {
        conditions.push(`o.estado = $${paramIndex}`);
        params.push(estado);
        paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
        `SELECT o.*,
            m.numero AS mesa_numero,
            u.nombre AS mesero_nombre,
            (SELECT COUNT(*) FROM ${TABLE.ORDEN_DETALLES} od 
             WHERE od.orden_id = o.id AND od.activo = TRUE) AS total_items,
            COALESCE((SELECT SUM(od.subtotal) FROM ${TABLE.ORDEN_DETALLES} od 
             WHERE od.orden_id = o.id AND od.activo = TRUE AND od.es_incluido_menu = FALSE), 0) AS subtotal
     FROM ${TABLE.ORDENES} o
     JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id
     JOIN ${TABLE.USUARIOS} u ON u.id = o.mesero_id
     WHERE ${whereClause}
     ORDER BY o.created_at DESC`,
        params
    );

    return result.rows;
}

async function getAllVentas(filtros = {}) {
    const { fecha_desde, fecha_hasta, cajero_id, metodo_pago, activo } = filtros;

    const conditions = ['v.activo = TRUE'];
    const params = [];
    let paramIndex = 1;

    if (fecha_desde) {
        conditions.push(`v.created_at >= $${paramIndex}`);
        params.push(fecha_desde);
        paramIndex++;
    }

    if (fecha_hasta) {
        conditions.push(`v.created_at <= $${paramIndex}`);
        params.push(fecha_hasta);
        paramIndex++;
    }

    if (cajero_id) {
        conditions.push(`v.cajero_id = $${paramIndex}`);
        params.push(cajero_id);
        paramIndex++;
    }

    if (metodo_pago) {
        conditions.push(`v.metodo_pago = $${paramIndex}`);
        params.push(metodo_pago);
        paramIndex++;
    }

    const whereClause = conditions.join(' AND ');

    const result = await query(
        `SELECT v.*,
            o.numero_comanda,
            m.numero AS mesa_numero,
            u.nombre AS cajero_nombre
     FROM ${TABLE.VENTAS} v
     JOIN ${TABLE.ORDENES} o ON o.id = v.orden_id
     JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id
     JOIN ${TABLE.USUARIOS} u ON u.id = v.cajero_id
     WHERE ${whereClause}
     ORDER BY v.created_at DESC`,
        params
    );

    return result.rows;
}

async function getVentaById(id) {
    const result = await query(
        `SELECT v.*,
            o.numero_comanda,
            m.numero AS mesa_numero,
            u.nombre AS cajero_nombre
     FROM ${TABLE.VENTAS} v
     JOIN ${TABLE.ORDENES} o ON o.id = v.orden_id
     JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id
     JOIN ${TABLE.USUARIOS} u ON u.id = v.cajero_id
     WHERE v.id = $1 AND v.activo = TRUE`,
        [id]
    );

    if (result.rows.length === 0) {
        throw AppError.notFound('Venta no encontrada');
    }

    // Obtener detalles de la venta
    const detalles = await query(
        `SELECT vd.*, p.nombre AS producto_nombre, p.tipo AS producto_tipo
     FROM ${TABLE.VENTAS_DETALLE} vd
     JOIN ${TABLE.PRODUCTOS} p ON p.id = vd.producto_id
     WHERE vd.venta_id = $1 AND vd.activo = TRUE
     ORDER BY vd.created_at ASC`,
        [id]
    );

    const venta = result.rows[0];
    return {
        ...venta,
        // Calcular vuelto: monto_pagado - total
        vuelto: parseFloat((venta.monto_pagado - venta.total).toFixed(2)),
        detalles: detalles.rows,
    };
}

async function crearVenta(data, usuario_id) {
    const { orden_id, metodo_pago, monto_pagado, descuento = 0, observaciones } = data;

    // Validar que el usuario es cajero o admin
    const usuario = await query(
        `SELECT u.id, r.nombre AS rol FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
        [usuario_id]
    );

    if (usuario.rows.length === 0) {
        throw AppError.unauthorized('Usuario no válido');
    }

    if (!['cajero', 'administrador'].includes(usuario.rows[0].rol)) {
        throw AppError.forbidden('Solo cajeros pueden crear ventas');
    }

    // Validar que la orden existe y está en estado válido para cobrar
    // ✅ CORRECCIÓN: Se permiten más estados ('abierta', 'preparando', 'lista', 'enviada_cocina')
    const orden = await query(
        `SELECT o.*, m.id AS mesa_id, m.numero AS mesa_numero
     FROM ${TABLE.ORDENES} o
     JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id
     WHERE o.id = $1 AND o.activo = TRUE`,
        [orden_id]
    );

    if (orden.rows.length === 0) {
        throw AppError.notFound('Orden no encontrada');
    }

    // ✅ CORRECCIÓN: Validar estados permitidos para cobrar
    if (!['abierta', 'enviada_cocina', 'preparando', 'lista'].includes(orden.rows[0].estado)) {
        throw AppError.conflict(
            `No se puede cobrar: orden en estado ${orden.rows[0].estado}. Debe estar en estado válido para cobro.`
        );
    }

    // Validar que no exista ya una venta para esta orden
    const ventaExistente = await query(
        `SELECT id FROM ${TABLE.VENTAS} WHERE orden_id = $1 AND activo = TRUE`,
        [orden_id]
    );

    if (ventaExistente.rows.length > 0) {
        throw AppError.conflict('Esta orden ya fue cobrada');
    }

    // Obtener detalles de la orden
    // ✅ CORRECCIÓN: Cambiar 'es_menu' por 'es_incluido_menu' (nombre correcto en BD)
    const detallesOrden = await query(
        `SELECT od.*, p.nombre AS producto_nombre, p.control_stock, od.es_incluido_menu
     FROM ${TABLE.ORDEN_DETALLES} od
     JOIN ${TABLE.PRODUCTOS} p ON p.id = od.producto_id
     WHERE od.orden_id = $1 AND od.activo = TRUE AND od.es_incluido_menu = FALSE`,
        [orden_id]
    );

    if (detallesOrden.rows.length === 0) {
        throw AppError.badRequest('La orden no tiene productos para cobrar');
    }

    // Calcular totales
    let subtotal = 0;
    detallesOrden.rows.forEach((detalle) => {
        subtotal += (parseFloat(detalle.precio) * parseInt(detalle.cantidad));
    });

    // Calcular IGV (18%)
    const totalConDescuento = subtotal - descuento;

    const subtotal_base = totalConDescuento / 1.18;
    const igv = totalConDescuento - subtotal_base;

    const total = totalConDescuento;

    // Validar monto pagado
    if (monto_pagado < total) {
        throw AppError.badRequest(
            `Monto pagado insuficiente. Total: S/ ${total}, Pagado: S/ ${monto_pagado}`
        );
    }

    // ==========================================
    // TRANSACCIÓN ATÓMICA
    // ==========================================
    const client = await getClient();

    try {
        await client.query('BEGIN');

        // 1. Crear venta
        const ventaResult = await client.query(
            `INSERT INTO ${TABLE.VENTAS} 
       (orden_id, cajero_id, subtotal, igv, descuento, total, metodo_pago, monto_pagado, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       RETURNING *`,
            [orden_id, usuario_id, subtotal, igv, descuento, total, metodo_pago, monto_pagado]
        );

        const venta = ventaResult.rows[0];

        // 2. Crear detalles de venta
        // ✅ CORRECCIÓN: Cambiar columna 'es_menu' por 'es_incluido_menu'
        for (const detalle of detallesOrden.rows) {
            await client.query(
                `INSERT INTO ${TABLE.VENTAS_DETALLE} 
         (venta_id, producto_id, cantidad, precio, es_incluido_menu, activo)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
                // ✅ CORRECCIÓN: Usar el valor real de es_incluido_menu del detalle
                [venta.id, detalle.producto_id, detalle.cantidad, detalle.precio, detalle.es_incluido_menu]
            );
            // Trigger automático: trg_venta_detalle_kardex descuenta stock si control_stock = TRUE
        }

        // 3. Registrar movimiento en caja (tipo 'venta')
        // 3. Registrar movimiento en caja (tipo 'venta')
        const descripcionMovimiento = `Venta #${venta.id}`;

        await client.query(
            `INSERT INTO ${TABLE.CAJA_MOVIMIENTOS}
   (caja_id, tipo, descripcion, monto, venta_id, usuario_id, activo)
   VALUES (
     (SELECT id FROM ${TABLE.CAJA_APERTURAS} WHERE estado = 'abierta' ORDER BY created_at DESC LIMIT 1),
     'venta',
     $1,
     $2,
     $3,
     $4,
     TRUE
   )`,
            [descripcionMovimiento, total, venta.id, usuario_id]
        );

        // 4. Actualizar orden a estado 'cobrada'
        await client.query(
            `UPDATE ${TABLE.ORDENES} 
       SET estado = 'cobrada', fecha_cierre = NOW(), updated_at = NOW()
       WHERE id = $1`,
            [orden_id]
        );

        // 5. Liberar mesa (cambiar estado a 'libre')
        await client.query(
            `UPDATE ${TABLE.MESAS} 
       SET estado = 'libre', updated_at = NOW()
       WHERE id = $1`,
            [orden.rows[0].mesa_id]
        );

        // 6. Registrar ticket de venta
        await client.query(
            `INSERT INTO ${TABLE.TICKETS_COCINA} (orden_id, tipo_ticket, impreso, activo)
       VALUES ($1, 'venta_cliente', FALSE, TRUE)`,
            [orden_id]
        );

        await client.query('COMMIT');

        // Retornar venta completa con detalles
        return await getVentaById(venta.id);
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error en transacción de venta:', error.message);
        throw error;
    } finally {
        client.release();
    }
}

async function anularVenta(id, usuario_id, motivo) {
    // Solo administrador puede anular ventas
    const usuario = await query(
        `SELECT u.id, r.nombre AS rol FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
        [usuario_id]
    );

    if (usuario.rows.length === 0 || usuario.rows[0].rol !== 'administrador') {
        throw AppError.forbidden('Solo administradores pueden anular ventas');
    }

    const client = await getClient();

    try {
        await client.query('BEGIN');

        // 1. Marcar venta como inactiva
        await client.query(
            `UPDATE ${TABLE.VENTAS} 
       SET activo = FALSE, updated_at = NOW()
       WHERE id = $1`,
            [id]
        );

        // 2. Marcar detalles como inactivos
        await client.query(
            `UPDATE ${TABLE.VENTAS_DETALLE} 
       SET activo = FALSE
       WHERE venta_id = $1`,
            [id]
        );

        // 3. Revertir orden a estado 'cancelada'
        await client.query(
            `UPDATE ${TABLE.ORDENES} 
       SET estado = 'cancelada', fecha_cierre = NOW(), updated_at = NOW()
       WHERE id = (SELECT orden_id FROM ${TABLE.VENTAS} WHERE id = $1)`,
            [id]
        );

        // 4. Registrar movimiento contrario en caja (tipo 'gasto' o 'retiro')
        const venta = await query(
            `SELECT total, cajero_id FROM ${TABLE.VENTAS} WHERE id = $1`,
            [id]
        );

        await client.query(
            `INSERT INTO ${TABLE.CAJA_MOVIMIENTOS} 
       (caja_id, tipo, descripcion, monto, usuario_id, activo)
       VALUES (
         (SELECT id FROM ${TABLE.CAJA_APERTURAS} WHERE estado = 'abierta' ORDER BY created_at DESC LIMIT 1),
         'gasto',
         'Anulación Venta #' || $1 || ' - ' || $2,
         $3,
         $4,
         TRUE
       )`,
            [id, motivo || 'Sin motivo', venta.rows[0].total, usuario_id]
        );

        await client.query('COMMIT');

        return { success: true, message: 'Venta anulada correctamente' };
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

async function getTicketData(id) {
    const venta = await getVentaById(id);

    return {
        numero_ticket: venta.numero_ticket,
        fecha: venta.created_at,
        mesa: venta.mesa_numero,
        cajero: venta.cajero_nombre,
        detalles: venta.detalles,
        subtotal: venta.subtotal,
        igv: venta.igv,
        descuento: venta.descuento,
        total: venta.total,
        metodo_pago: venta.metodo_pago,
        monto_pagado: venta.monto_pagado,
        vuelto: venta.vuelto,
    };
}

module.exports = {
    getOrdenesPorCobrar,  // ← NUEVA FUNCIÓN
    getAllVentas,
    getVentaById,
    crearVenta,
    anularVenta,
    getTicketData,
};