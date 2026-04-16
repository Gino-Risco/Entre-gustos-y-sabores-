const { query, TABLE, getClient } = require('../config/database');
const AppError = require('../utils/AppError');

// Estados válidos para transiciones
const ESTADOS_VALIDOS = ['abierta', 'enviada_cocina', 'preparando', 'lista', 'cobrada', 'cancelada'];

async function getAllOrdenes(filtros = {}) {
  const { estado, mesa_id, mesero_id, activo, fecha_desde, fecha_hasta } = filtros;

  const conditions = ['o.activo = TRUE'];
  const params = [];
  let paramIndex = 1;

  if (estado) {
    conditions.push(`o.estado = $${paramIndex}`);
    params.push(estado);
    paramIndex++;
  }

  if (mesa_id) {
    conditions.push(`o.mesa_id = $${paramIndex}`);
    params.push(mesa_id);
    paramIndex++;
  }

  if (mesero_id) {
    conditions.push(`o.mesero_id = $${paramIndex}`);
    params.push(mesero_id);
    paramIndex++;
  }

  if (fecha_desde) {
    conditions.push(`o.created_at >= $${paramIndex}`);
    params.push(fecha_desde);
    paramIndex++;
  }

  if (fecha_hasta) {
    conditions.push(`o.created_at <= $${paramIndex}`);
    params.push(fecha_hasta);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  // ✅ CORRECCIÓN: Retornamos directamente el resultado del query
  const result = await query(
    `SELECT o.*,
            COALESCE(m.numero::text, 'Para Llevar') AS mesa_numero,
            u.nombre AS mesero_nombre,
            o.nombre_cliente,
            (SELECT COALESCE(SUM(cantidad), 0) FROM ${TABLE.ORDEN_DETALLES} od WHERE od.orden_id = o.id AND od.activo = TRUE) AS cantidad_items,
            (SELECT COALESCE(SUM(precio * cantidad), 0) FROM ${TABLE.ORDEN_DETALLES} od WHERE od.orden_id = o.id AND od.activo = TRUE) AS total_calculado,
            ((SELECT COALESCE(SUM(precio * cantidad), 0) FROM ${TABLE.ORDEN_DETALLES} od WHERE od.orden_id = o.id AND od.activo = TRUE) - COALESCE(o.descuento_total, 0)) AS total_real
     FROM ${TABLE.ORDENES} o
     LEFT JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id
     JOIN ${TABLE.USUARIOS} u ON u.id = o.mesero_id
     WHERE ${whereClause}
     ORDER BY o.created_at DESC`,
    params
  );

  // ✅ Simplemente retornamos las filas, el frontend se encargará del resto
  return result.rows;
}

async function getOrdenById(id) {
  // ✅ CAMBIO: Agregado o.nombre_cliente en el SELECT
  const result = await query(
    `SELECT o.*,
            COALESCE(m.numero::text, 'Para Llevar') AS mesa_numero,
            u.nombre AS mesero_nombre,
            o.nombre_cliente
     FROM ${TABLE.ORDENES} o
     LEFT JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id /* <-- CAMBIO CLAVE: LEFT JOIN */
     JOIN ${TABLE.USUARIOS} u ON u.id = o.mesero_id
     WHERE o.id = $1 AND o.activo = TRUE`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Orden no encontrada');
  }

  // Obtener detalles de la orden con campos del combo menú
  const detalles = await query(
    `SELECT od.*, 
            p.nombre AS producto_nombre, 
            p.tipo AS producto_tipo,
            p.categoria_id,
            c.nombre AS categoria_nombre,
            od.es_menu,
            od.entrada_incluida,
            od.fondo_incluido
     FROM ${TABLE.ORDEN_DETALLES} od
     JOIN ${TABLE.PRODUCTOS} p ON p.id = od.producto_id
     LEFT JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE od.orden_id = $1 AND od.activo = TRUE
     ORDER BY od.created_at ASC`,
    [id]
  );

  // ✅ CORRECCIÓN: Calcular total_real considerando el descuento
  const totalBruto = detalles.rows.reduce((sum, d) => sum + parseFloat(d.subtotal || 0), 0);
  const descuento = parseFloat(result.rows[0].descuento_total || 0);
  const totalReal = totalBruto - descuento;

  return {
    ...result.rows[0],
    detalles: detalles.rows,
    total_real: totalReal, // ✅ NUEVO
    total: totalReal // Por si el frontend usa 'total' también
  };
}

async function getOrdenActivaPorMesa(mesa_id) {
  const result = await query(
    `SELECT o.*,
            m.numero AS mesa_numero,
            u.nombre AS mesero_nombre
     FROM ${TABLE.ORDENES} o
     JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id
     JOIN ${TABLE.USUARIOS} u ON u.id = o.mesero_id
     WHERE o.mesa_id = $1 
       AND o.estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista')
       AND o.activo = TRUE
     ORDER BY o.created_at DESC
     LIMIT 1`,
    [mesa_id]
  );

  if (result.rows.length === 0) {
    return null;
  }

  // Obtener detalles
  const detalles = await query(
    `SELECT od.*, 
            p.nombre AS producto_nombre, 
            p.tipo AS producto_tipo,
            od.es_menu,
            od.entrada_incluida,
            od.fondo_incluido
     FROM ${TABLE.ORDEN_DETALLES} od
     JOIN ${TABLE.PRODUCTOS} p ON p.id = od.producto_id
     WHERE od.orden_id = $1 AND od.activo = TRUE
     ORDER BY od.created_at ASC`,
    [result.rows[0].id]
  );

  return {
    ...result.rows[0],
    detalles: detalles.rows,
  };
}

async function createOrden(data, usuario_id) {
  // ✅ CAMBIO: Agregado nombre_cliente en el destructuring
  const { mesa_id, observaciones, tipo_pedido = 'salon', nombre_cliente } = data;

  // Si es en salón, validamos la mesa obligatoriamente
  if (tipo_pedido === 'salon') {
    if (!mesa_id) throw AppError.badRequest('Debe seleccionar una mesa para consumo en salón');

    const mesa = await query(
      `SELECT id, numero, estado FROM ${TABLE.MESAS} WHERE id = $1 AND activo = TRUE`,
      [mesa_id]
    );

    if (mesa.rows.length === 0) throw AppError.notFound('Mesa no encontrada');
    if (!['libre', 'reservada'].includes(mesa.rows[0].estado)) {
      throw AppError.conflict(`La mesa ${mesa.rows[0].numero} ya está ocupada`);
    }

    // ✅ CORRECCIÓN: Validación correcta para ver si la mesa ya tiene una orden activa
    const ordenExistente = await query(
      `SELECT id FROM ${TABLE.ORDENES} 
       WHERE mesa_id = $1 AND estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista') AND activo = TRUE`,
      [mesa_id]
    );

    if (ordenExistente.rows.length > 0) throw AppError.conflict('Ya existe una orden activa en esta mesa');
  }

  // ✅ NUEVO: Validar nombre_cliente obligatorio para pedidos para llevar
  if (tipo_pedido === 'llevar' && (!nombre_cliente || nombre_cliente.trim() === '')) {
    throw AppError.badRequest('El nombre del cliente es requerido para pedidos para llevar');
  }

  // Validar rol de usuario (solo administradores o cajeros/meseros pueden crear)
  const usuario = await query(
    `SELECT u.id, r.nombre AS rol FROM ${TABLE.USUARIOS} u
     JOIN ${TABLE.ROLES} r ON r.id = u.rol_id
     WHERE u.id = $1 AND u.activo = TRUE`,
    [usuario_id]
  );

  if (usuario.rows.length === 0) throw AppError.unauthorized('Usuario no válido');

  // Insertar la orden. Si es 'llevar', mesa_id será null automáticamente
  const mesaFinalId = tipo_pedido === 'salon' ? mesa_id : null;

  // ✅ CAMBIO: INSERT ahora incluye nombre_cliente
  const result = await query(
    `INSERT INTO ${TABLE.ORDENES} (mesa_id, mesero_id, observaciones, estado, tipo_pedido, nombre_cliente, activo)
     VALUES ($1, $2, $3, 'abierta', $4, $5, TRUE)
     RETURNING *`,
    [mesaFinalId, usuario_id, observaciones || null, tipo_pedido, nombre_cliente?.trim() || null]
  );

  // Solo ocupamos la mesa si es pedido de salón
  if (tipo_pedido === 'salon') {
    await query(
      `UPDATE ${TABLE.MESAS} SET estado = 'ocupada', updated_at = NOW() WHERE id = $1`,
      [mesaFinalId]
    );
  }

  return result.rows[0];
}

async function agregarDetalleOrden(orden_id, detalles, usuario_id) {
  // detalles = [{ producto_id, cantidad, precio, observaciones, es_menu, entrada_incluida, fondo_incluido }]

  if (!Array.isArray(detalles) || detalles.length === 0) {
    throw AppError.badRequest('Debe proporcionar al menos un detalle');
  }

  // Validar que la orden existe y está abierta o en cocina
  const orden = await query(
    `SELECT id, estado, mesa_id FROM ${TABLE.ORDENES} WHERE id = $1 AND activo = TRUE`,
    [orden_id]
  );

  if (orden.rows.length === 0) {
    throw AppError.notFound('Orden no encontrada');
  }

  if (!['abierta', 'enviada_cocina', 'preparando', 'lista'].includes(orden.rows[0].estado)) {
    throw AppError.conflict(`No se pueden agregar detalles: orden en estado ${orden.rows[0].estado}`);
  }

  // Validar productos y preparar datos
  const productoIds = detalles.map(d => d.producto_id);
  const productosResult = await query(
    `SELECT id, nombre, tipo, control_stock, stock_actual, permite_stock_negativo, disponible_en_menu
     FROM ${TABLE.PRODUCTOS} WHERE id = ANY($1) AND activo = TRUE`,
    [productoIds]
  );

  if (productosResult.rows.length !== productoIds.length) {
    throw AppError.badRequest('Uno o más productos no existen o están inactivos');
  }

  const productosMap = {};
  productosResult.rows.forEach(p => {
    productosMap[p.id] = p;
  });

  // Validar stock para productos con control_stock = TRUE
  for (const detalle of detalles) {
    const producto = productosMap[detalle.producto_id];
    if (producto.control_stock && !producto.permite_stock_negativo) {
      if (producto.stock_actual < detalle.cantidad) {
        throw AppError.badRequest(
          `Stock insuficiente para "${producto.nombre}". Disponible: ${producto.stock_actual}, Solicitado: ${detalle.cantidad}`
        );
      }
    }
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    const insertedDetails = [];

    for (const detalle of detalles) {
      const result = await client.query(
        `INSERT INTO ${TABLE.ORDEN_DETALLES} 
         (orden_id, producto_id, cantidad, precio, observaciones, es_menu, entrada_incluida, fondo_incluido, activo, enviado_cocina)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, FALSE)
         RETURNING *`,
        [
          orden_id,
          detalle.producto_id,
          detalle.cantidad,
          detalle.precio,
          detalle.observaciones || null,
          detalle.es_menu || false,
          detalle.entrada_incluida ? JSON.stringify(detalle.entrada_incluida) : null,
          detalle.fondo_incluido ? JSON.stringify(detalle.fondo_incluido) : null,
        ]
      );

      insertedDetails.push(result.rows[0]);
    }

    await client.query('COMMIT');
    return insertedDetails;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// 👇 NUEVO: Agregamos el parámetro 'observaciones' con un valor por defecto vacío
async function enviarACocina(orden_id, usuario_id, observaciones = {}) {
  // ✅ CAMBIO: Agregado o.nombre_cliente en el SELECT
  const orden = await query(
    `SELECT o.*, 
            COALESCE(m.numero::text, 'Para Llevar') AS mesa_numero, 
            u.nombre AS mesero_nombre,
            o.nombre_cliente
     FROM ${TABLE.ORDENES} o
     LEFT JOIN ${TABLE.MESAS} m ON m.id = o.mesa_id /* <-- AHORA ES LEFT JOIN */
     JOIN ${TABLE.USUARIOS} u ON u.id = o.mesero_id
     WHERE o.id = $1 AND o.activo = TRUE`,
    [orden_id]
  );

  if (orden.rows.length === 0) {
    throw AppError.notFound('Orden no encontrada');
  }

  // Obtener SOLO los items pendientes ANTES de marcar
  const pendientes = await query(
    `SELECT od.*, 
            p.nombre AS producto_nombre, 
            p.tipo AS producto_tipo,
            c.nombre AS categoria_nombre,
            od.es_menu,
            od.entrada_incluida,
            od.fondo_incluido
     FROM ${TABLE.ORDEN_DETALLES} od
     JOIN ${TABLE.PRODUCTOS} p ON p.id = od.producto_id
     LEFT JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE od.orden_id = $1 
       AND od.activo = TRUE 
       AND od.enviado_cocina = FALSE
     ORDER BY od.created_at ASC`,
    [orden_id]
  );

  if (pendientes.rows.length === 0) {
    throw AppError.badRequest('No hay productos pendientes para enviar a cocina');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 👇 NUEVO: 1. Guardar las observaciones en la Base de Datos primero 👇
    if (observaciones && Object.keys(observaciones).length > 0) {
      for (const [detalleId, nota] of Object.entries(observaciones)) {
        if (nota && nota.trim() !== '') {
          await client.query(
            `UPDATE ${TABLE.ORDEN_DETALLES} 
             SET observaciones = $1 
             WHERE id = $2 AND orden_id = $3`,
            [nota.trim(), detalleId, orden_id]
          );
        }
      }
    }

    // 2. Marcar TODOS los pendientes como enviados
    await client.query(
      `UPDATE ${TABLE.ORDEN_DETALLES} 
       SET enviado_cocina = TRUE, fecha_envio_cocina = NOW(), updated_at = NOW()
       WHERE orden_id = $1 AND enviado_cocina = FALSE AND activo = TRUE`,
      [orden_id]
    );

    // 3. Registrar ticket de cocina
    await client.query(
      `INSERT INTO ${TABLE.TICKETS_COCINA} (orden_id, tipo_ticket, impreso, activo)
       VALUES ($1, 'pedido_cocina', FALSE, TRUE)`,
      [orden_id]
    );

    await client.query('COMMIT');

    // 👇 NUEVO: 4. Acoplar las notas a los pendientes para que el ticket las imprima 👇
    const detallesActualizados = pendientes.rows.map(d => ({
      ...d,
      observaciones: observaciones[d.id] || d.observaciones
    }));

    return {
      orden: orden.rows[0],
      detalles: detallesActualizados, // Retorna los pendientes ya con las notas puestas
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// NUEVA FUNCIÓN: Obtener solo los detalles NUEVOS para imprimir en cocina
async function getDetallesNuevosParaCocina(orden_id) {
  const result = await query(
    `SELECT od.*, 
            p.nombre AS producto_nombre, 
            p.tipo AS producto_tipo,
            c.nombre AS categoria_nombre,
            od.es_menu,
            od.entrada_incluida,
            od.fondo_incluido
     FROM ${TABLE.ORDEN_DETALLES} od
     JOIN ${TABLE.PRODUCTOS} p ON p.id = od.producto_id
     LEFT JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE od.orden_id = $1 
       AND od.activo = TRUE 
       AND od.enviado_cocina = TRUE
       AND od.fecha_envio_cocina >= NOW() - INTERVAL '5 minutes'
     ORDER BY od.es_menu DESC, od.created_at ASC`,
    [orden_id]
  );

  return result.rows;
}

// ACTUALIZADA: Obtener detalles para cocina con campos de combo menú
async function getDetallesParaCocina(orden_id) {
  const result = await query(
    `SELECT od.*, 
            p.nombre AS producto_nombre, 
            p.tipo AS producto_tipo,
            c.nombre AS categoria_nombre,
            od.es_menu,
            od.entrada_incluida,
            od.fondo_incluido
     FROM ${TABLE.ORDEN_DETALLES} od
     JOIN ${TABLE.PRODUCTOS} p ON p.id = od.producto_id
     LEFT JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE od.orden_id = $1 AND od.activo = TRUE
     ORDER BY od.es_menu DESC, od.created_at ASC`,
    [orden_id]
  );

  return result.rows;
}

// NUEVA FUNCIÓN: Obtener productos disponibles para Menú del Día
async function getProductosParaMenu() {
  const result = await query(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM ${TABLE.PRODUCTOS} p
     JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE p.disponible_en_menu = TRUE 
       AND p.activo = TRUE
       AND c.nombre IN ('Entradas', 'Platos de Fondo')
     ORDER BY c.nombre, p.nombre ASC`
  );

  return result.rows;
}

async function actualizarEstadoOrden(orden_id, nuevo_estado, usuario_id) {
  if (!ESTADOS_VALIDOS.includes(nuevo_estado)) {
    throw AppError.badRequest(`Estado inválido. Estados permitidos: ${ESTADOS_VALIDOS.join(', ')}`);
  }

  const orden = await query(
    `SELECT id, estado, mesa_id FROM ${TABLE.ORDENES} WHERE id = $1 AND activo = TRUE`,
    [orden_id]
  );

  if (orden.rows.length === 0) {
    throw AppError.notFound('Orden no encontrada');
  }

  const estadoActual = orden.rows[0].estado;

  // Validar transiciones de estado
  const transicionesValidas = {
    'abierta': ['enviada_cocina', 'cancelada'],
    'enviada_cocina': ['preparando', 'cancelada', 'abierta'], // ← Permitir volver a abierta para agregar más
    'preparando': ['lista', 'cancelada', 'abierta'],
    'lista': ['cobrada', 'cancelada', 'abierta'],
    'cobrada': [],
    'cancelada': [],
  };

  if (!transicionesValidas[estadoActual].includes(nuevo_estado)) {
    throw AppError.badRequest(
      `Transición inválida de ${estadoActual} a ${nuevo_estado}`
    );
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Actualizar estado de orden
    const result = await client.query(
      `UPDATE ${TABLE.ORDENES} 
       SET estado = $1, updated_at = NOW(), 
           fecha_cierre = CASE WHEN $1 IN ('cobrada', 'cancelada') THEN NOW() ELSE NULL END
       WHERE id = $2
       RETURNING *`,
      [nuevo_estado, orden_id]
    );

    // ✅ CAMBIO: Solo liberar mesa si tiene mesa asignada (Para Llevar no tiene mesa)
    if (['cobrada', 'cancelada'].includes(nuevo_estado) && orden.rows[0].mesa_id) {
      await client.query(
        `UPDATE ${TABLE.MESAS} SET estado = 'libre', updated_at = NOW() WHERE id = $1`,
        [orden.rows[0].mesa_id]
      );
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// NUEVA FUNCIÓN: Anulación inteligente de órdenes
async function anularOrdenYLiberarMesa(orden_id, usuario_id, motivo) {
  // 1. Buscamos la orden y contamos cuántos productos activos tiene
  const ordenResult = await query(
    `SELECT o.id, o.estado, o.mesa_id, 
            (SELECT COUNT(*) FROM ${TABLE.ORDEN_DETALLES} od WHERE od.orden_id = o.id AND od.activo = TRUE) AS cantidad_items
     FROM ${TABLE.ORDENES} o 
     WHERE o.id = $1 AND o.activo = TRUE`,
    [orden_id]
  );

  if (ordenResult.rows.length === 0) {
    throw AppError.notFound('Orden no encontrada');
  }

  const orden = ordenResult.rows[0];

  if (['cobrada', 'cancelada'].includes(orden.estado)) {
    throw AppError.conflict(`No se puede modificar una orden que ya está ${orden.estado}`);
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    if (parseInt(orden.cantidad_items) === 0) {
      // ESCENARIO A: Orden Vacía (Error de clic del mesero)
      // Hacemos un "Soft-Delete" (activo = FALSE). Desaparece de los reportes y vistas.
      await client.query(
        `UPDATE ${TABLE.ORDENES} 
         SET activo = FALSE, 
             observaciones = $1, 
             updated_at = NOW() 
         WHERE id = $2`,
        [`Anulada (Sin items) - Motivo: ${motivo || 'Error de creación'}`, orden_id]
      );
    } else {
      // ESCENARIO B: Orden con Productos (Los clientes se fueron sin pagar)
      // Cambiamos estado a 'cancelada' y activo = TRUE para mantener el rastro de auditoría.
      await client.query(
        `UPDATE ${TABLE.ORDENES} 
         SET estado = 'cancelada', 
             fecha_cierre = NOW(), 
             observaciones_cierre = $1, 
             updated_at = NOW() 
         WHERE id = $2`,
        [motivo || 'Cliente se retiró / Pedido anulado', orden_id]
      );
    }

    // Finalmente: En CUALQUIER escenario, si la orden tenía mesa, la liberamos
    if (orden.mesa_id) {
      await client.query(
        `UPDATE ${TABLE.MESAS} 
         SET estado = 'libre', 
             updated_at = NOW() 
         WHERE id = $1`,
        [orden.mesa_id]
      );
    }

    await client.query('COMMIT');
    return {
      success: true,
      message: parseInt(orden.cantidad_items) === 0
        ? 'Mesa liberada. Orden vacía eliminada del registro.'
        : 'Mesa liberada. Orden con productos anulada y registrada.'
    };

  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// NUEVA FUNCIÓN: Cerrar orden (cobrar)
async function cerrarOrden(orden_id, datosPago, usuario_id) {
  const { total, metodo_pago, numero_comprobante, observaciones_cierre } = datosPago;

  const orden = await query(
    `SELECT id, estado, mesa_id, subtotal FROM ${TABLE.ORDENES} WHERE id = $1 AND activo = TRUE`,
    [orden_id]
  );

  if (orden.rows.length === 0) {
    throw AppError.notFound('Orden no encontrada');
  }

  if (orden.rows[0].estado === 'cobrada') {
    throw AppError.conflict('Esta orden ya fue cobrada');
  }

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Actualizar orden con datos de pago
    const result = await client.query(
      `UPDATE ${TABLE.ORDENES} 
       SET estado = 'cobrada',
           total = $1,
           metodo_pago = $2,
           numero_comprobante = $3,
           observaciones_cierre = $4,
           fecha_cierre = NOW(),
           updated_at = NOW()
       WHERE id = $5
       RETURNING *`,
      [total, metodo_pago, numero_comprobante, observaciones_cierre || null, orden_id]
    );

    // ✅ CAMBIO: Solo liberar mesa si tiene mesa asignada (Para Llevar no tiene mesa)
    if (orden.rows[0].mesa_id) {
      await client.query(
        `UPDATE ${TABLE.MESAS} SET estado = 'libre', updated_at = NOW() WHERE id = $1`,
        [orden.rows[0].mesa_id]
      );
    }

    await client.query('COMMIT');
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function eliminarDetalleOrden(orden_id, detalle_id, usuario_id) {
  // Validar que la orden existe
  const orden = await query(
    `SELECT id, estado FROM ${TABLE.ORDENES} 
     WHERE id = $1 AND activo = TRUE`,
    [orden_id]
  );

  if (orden.rows.length === 0) {
    throw AppError.notFound('Orden no encontrada');
  }

  // No se puede eliminar detalles de órdenes cobradas
  if (orden.rows[0].estado === 'cobrada') {
    throw AppError.conflict('No se pueden modificar órdenes cobradas');
  }

  // Validar que el detalle existe y pertenece a esta orden
  const detalle = await query(
    `SELECT id FROM ${TABLE.ORDEN_DETALLES}
     WHERE id = $1 AND orden_id = $2 AND activo = TRUE`,
    [detalle_id, orden_id]
  );

  if (detalle.rows.length === 0) {
    throw AppError.notFound('Detalle de orden no encontrado');
  }

  // Marcar detalle como inactivo (soft delete)
  await query(
    `UPDATE ${TABLE.ORDEN_DETALLES} 
     SET activo = FALSE, updated_at = NOW()
     WHERE id = $1`,
    [detalle_id]
  );

  return { success: true, message: 'Detalle eliminado correctamente' };
}

// NUEVA FUNCIÓN: Aplicar cortesía (precio cero) a un plato devuelto o mala preparación
async function aplicarCortesiaDetalle(orden_id, detalle_id, motivo, usuario_id) {
  const orden = await query(
    `SELECT id, estado FROM ${TABLE.ORDENES} WHERE id = $1 AND activo = TRUE`,
    [orden_id]
  );

  if (orden.rows.length === 0) throw AppError.notFound('Orden no encontrada');
  if (orden.rows[0].estado === 'cobrada') throw AppError.conflict('No se puede modificar una orden ya cobrada');

  const detalle = await query(
    `SELECT id, precio, cantidad FROM ${TABLE.ORDEN_DETALLES} WHERE id = $1 AND orden_id = $2 AND activo = TRUE`,
    [detalle_id, orden_id]
  );

  if (detalle.rows.length === 0) throw AppError.notFound('Detalle no encontrado');

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // Mantenemos el registro (activo = TRUE), pero ponemos el precio en 0 y grabamos el motivo
    await client.query(
      `UPDATE ${TABLE.ORDEN_DETALLES} 
       SET precio = 0, 
           observaciones = $1, 
           updated_at = NOW()
       WHERE id = $2`,
      [`[CORTESÍA/ANULADO] - Motivo: ${motivo || 'Error de cocina / Cliente no paga'}`, detalle_id]
    );

    await client.query('COMMIT');
    return { success: true, message: 'Plato anulado de la cuenta (Cortesía aplicada)' };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// NUEVA FUNCIÓN: Aplicar descuento global (Soporta Porcentaje y Monto Fijo)
async function aplicarDescuentoGlobal(orden_id, datosDescuento) {
  const { tipo, valor, total_descontado, motivo } = datosDescuento;

  const orden = await query(
    `SELECT id, estado FROM pos.ordenes WHERE id = $1 AND activo = TRUE`,
    [orden_id]
  );

  if (orden.rows.length === 0) throw AppError.notFound('Orden no encontrada');
  if (orden.rows[0].estado === 'cobrada') throw AppError.conflict('No se puede modificar una orden ya cobrada');

  // Actualizamos la orden con la nueva estructura
  const result = await query(
    `UPDATE pos.ordenes 
     SET descuento_tipo = $1,
         descuento_valor = $2,
         descuento_total = $3, 
         motivo_descuento = $4, 
         updated_at = NOW() 
     WHERE id = $5 RETURNING *`,
    [tipo, valor, total_descontado, motivo || 'Descuento manual', orden_id]
  );

  return {
    success: true,
    message: 'Descuento aplicado correctamente',
    orden: result.rows[0]
  };
}

module.exports = {
  getAllOrdenes,
  getOrdenById,
  getOrdenActivaPorMesa,
  createOrden,
  agregarDetalleOrden,
  eliminarDetalleOrden,
  enviarACocina,
  getDetallesParaCocina,
  getDetallesNuevosParaCocina,
  actualizarEstadoOrden,
  anularOrdenYLiberarMesa,
  cerrarOrden,
  getProductosParaMenu,
  aplicarCortesiaDetalle,
  aplicarDescuentoGlobal,
};
