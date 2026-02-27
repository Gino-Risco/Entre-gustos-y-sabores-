const pool = require('../config/db');

class PedidosService {
  async crear({ mesa_id, mesero_id, turno_id, detalles }) {
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const mesaResult = await client.query(
        'SELECT estado FROM mesas WHERE id = $1 AND activo = true',
        [mesa_id]
      );

      if (mesaResult.rows.length === 0) {
        throw new Error('Mesa no encontrada');
      }

      const turnoResult = await client.query(
        "SELECT id FROM turnos_caja WHERE id = $1 AND estado = 'abierto'",
        [turno_id]
      );

      if (turnoResult.rows.length === 0) {
        throw new Error('No hay un turno de caja abierto');
      }

      const pedidoResult = await client.query(
        `INSERT INTO pedidos (mesa_id, mesero_id, turno_id, estado, descuento_global) 
         VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [mesa_id, mesero_id, turno_id, 'abierto', 0]
      );

      const pedido = pedidoResult.rows[0];

      for (const detalle of detalles) {
        const productoResult = await client.query(
          'SELECT precio_venta, activo FROM productos WHERE id = $1',
          [detalle.producto_id]
        );

        if (productoResult.rows.length === 0) {
          throw new Error(`Producto ${detalle.producto_id} no encontrado`);
        }

        if (!productoResult.rows[0].activo) {
          throw new Error(`Producto ${detalle.producto_id} no está disponible`);
        }

        const precio = productoResult.rows[0].precio_venta;
        const subtotal = precio * detalle.cantidad;

        await client.query(
          `INSERT INTO pedido_detalles (pedido_id, producto_id, cantidad, precio_unitario, subtotal, observaciones) 
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [pedido.id, detalle.producto_id, detalle.cantidad, precio, subtotal, detalle.observaciones || null]
        );
      }

      await client.query(
        "UPDATE mesas SET estado = 'ocupada' WHERE id = $1",
        [mesa_id]
      );

      await client.query('COMMIT');

      return await this.obtenerPorId(pedido.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      `SELECT * FROM vista_total_pedidos WHERE pedido_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Pedido no encontrado');
    }

    const pedido = result.rows[0];

    const detallesResult = await pool.query(
      `SELECT 
        pd.*,
        pr.nombre as producto_nombre,
        pr.tipo as producto_tipo
       FROM pedido_detalles pd
       JOIN productos pr ON pd.producto_id = pr.id
       WHERE pd.pedido_id = $1
       ORDER BY pd.fecha_envio`,
      [id]
    );

    return {
      ...pedido,
      detalles: detallesResult.rows
    };
  }

  async obtenerPorMesa(mesa_id) {
    const result = await pool.query(
      `SELECT * FROM pedidos 
       WHERE mesa_id = $1 AND estado = 'abierto' 
       ORDER BY fecha_apertura DESC`,
      [mesa_id]
    );

    const pedidos = [];
    for (const pedido of result.rows) {
      pedidos.push(await this.obtenerPorId(pedido.id));
    }

    return pedidos;
  }

  async actualizarEstadoDetalle(pedido_id, detalle_id, estado_cocina, usuario_cocina_id) {
    const estadosValidos = ['pendiente', 'cocinando', 'listo', 'servido', 'cancelado'];
    
    if (!estadosValidos.includes(estado_cocina)) {
      throw new Error(`Estado inválido. Debe ser uno de: ${estadosValidos.join(', ')}`);
    }

    const result = await pool.query(
      `UPDATE pedido_detalles 
       SET estado_cocina = $1, 
           usuario_cocina_id = $2,
           fecha_listo = CASE WHEN $1 IN ('listo', 'servido') THEN CURRENT_TIMESTAMP ELSE fecha_listo END
       WHERE id = $3 AND pedido_id = $4 
       RETURNING *`,
      [estado_cocina, usuario_cocina_id, detalle_id, pedido_id]
    );

    if (result.rows.length === 0) {
      throw new Error('Detalle de pedido no encontrado');
    }

    return result.rows[0];
  }

  async cerrarPedido(pedido_id, usuario_id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const pendientesResult = await client.query(
        `SELECT COUNT(*) as count FROM pedido_detalles 
         WHERE pedido_id = $1 AND estado_cocina IN ('pendiente', 'cocinando', 'listo')`,
        [pedido_id]
      );

      if (parseInt(pendientesResult.rows[0].count) > 0) {
        throw new Error('Hay platos pendientes de servir. No se puede cerrar el pedido.');
      }

      const result = await client.query(
        `UPDATE pedidos 
         SET estado = 'cerrado', fecha_cierre = CURRENT_TIMESTAMP 
         WHERE id = $1 RETURNING *`,
        [pedido_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Pedido no encontrado');
      }

      const pedido = result.rows[0];
      await client.query(
        "UPDATE mesas SET estado = 'sucia' WHERE id = $1",
        [pedido.mesa_id]
      );

      await client.query('COMMIT');

      return await this.obtenerPorId(pedido_id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async cancelarPedido(pedido_id, motivo, usuario_id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const pagosResult = await client.query(
        'SELECT COUNT(*) as count FROM pagos WHERE pedido_id = $1',
        [pedido_id]
      );

      if (parseInt(pagosResult.rows[0].count) > 0) {
        throw new Error('No se puede cancelar un pedido con pagos registrados. Procese la devolución primero.');
      }

      const result = await client.query(
        `UPDATE pedidos 
         SET estado = 'cancelado', 
             fecha_cierre = CURRENT_TIMESTAMP,
             motivo_cancelacion = $1,
             usuario_cancelacion_id = $2,
             fecha_cancelacion = CURRENT_TIMESTAMP
         WHERE id = $3 RETURNING *`,
        [motivo, usuario_id, pedido_id]
      );

      if (result.rows.length === 0) {
        throw new Error('Pedido no encontrado');
      }

      await client.query(
        `UPDATE pedido_detalles 
         SET estado_cocina = 'cancelado' 
         WHERE pedido_id = $1 AND estado_cocina NOT IN ('servido', 'cancelado')`,
        [pedido_id]
      );

      await client.query(
        "UPDATE mesas SET estado = 'libre' WHERE id = (SELECT mesa_id FROM pedidos WHERE id = $1)",
        [pedido_id]
      );

      await client.query('COMMIT');

      return await this.obtenerPorId(pedido_id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async agregarPago(pedido_id, { monto, metodo_pago, referencia_pago, usuario_id }) {
    const metodosValidos = ['efectivo', 'tarjeta', 'yape', 'plin'];
    
    if (!metodosValidos.includes(metodo_pago)) {
      throw new Error(`Método de pago inválido. Debe ser uno de: ${metodosValidos.join(', ')}`);
    }

    const pedido = await this.obtenerPorId(pedido_id);
    
    if (pedido.estado_pedido !== 'cerrado' && pedido.estado !== 'cerrado') {
      throw new Error('El pedido debe estar cerrado antes de registrar pagos');
    }

    const totalPendiente = parseFloat(pedido.saldo_pendiente || pedido.total_calculado);

    if (monto > totalPendiente) {
      throw new Error(`El monto excede el saldo pendiente. Pendiente: ${totalPendiente}`);
    }

    const result = await pool.query(
      `INSERT INTO pagos (pedido_id, monto, metodo_pago, referencia_pago, usuario_id) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [pedido_id, monto, metodo_pago, referencia_pago || null, usuario_id]
    );

    return result.rows[0];
  }

  async anularPago(pago_id, usuario_id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const pagoResult = await client.query(
        'SELECT * FROM pagos WHERE id = $1',
        [pago_id]
      );

      if (pagoResult.rows.length === 0) {
        throw new Error('Pago no encontrado');
      }

      await client.query(
        `UPDATE pagos 
         SET anulado = true 
         WHERE id = $1`,
        [pago_id]
      );

      await client.query(
        `INSERT INTO auditoria (usuario_id, accion, tabla_afectada, registro_id, detalles)
         VALUES ($1, $2, $3, $4, $5)`,
        [usuario_id, 'Anular pago', 'pagos', pago_id, JSON.stringify({ motivo: 'Devolución' })]
      );

      await client.query('COMMIT');

      return { message: 'Pago anulado correctamente' };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async obtenerPedidosCocina() {
    const result = await pool.query(
      `SELECT 
        pd.id,
        pd.pedido_id,
        pd.producto_id,
        pd.cantidad,
        pd.estado_cocina,
        pd.observaciones,
        pd.fecha_envio,
        pr.nombre as producto_nombre,
        pr.tipo as producto_tipo,
        m.nombre as mesa_nombre,
        u.nombre_completo as mesero_nombre
       FROM pedido_detalles pd
       JOIN productos pr ON pd.producto_id = pr.id
       JOIN pedidos p ON pd.pedido_id = p.id
       JOIN mesas m ON p.mesa_id = m.id
       JOIN usuarios u ON p.mesero_id = u.id
       WHERE pd.estado_cocina IN ('pendiente', 'cocinando', 'listo')
       ORDER BY pd.fecha_envio ASC`
    );

    return result.rows;
  }
}

module.exports = new PedidosService();