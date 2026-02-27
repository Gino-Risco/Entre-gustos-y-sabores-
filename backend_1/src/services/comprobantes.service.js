const pool = require('../config/db');

class ComprobantesService {
  async obtenerTodos() {
    const result = await pool.query(
      `SELECT 
        c.*,
        p.estado as estado_pedido,
        u.nombre_completo as usuario_nombre
       FROM comprobantes c
       JOIN pedidos p ON c.pedido_id = p.id
       JOIN usuarios u ON c.usuario_id = u.id
       ORDER BY c.fecha_emision DESC`
    );
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      `SELECT 
        c.*,
        p.estado as estado_pedido,
        u.nombre_completo as usuario_nombre
       FROM comprobantes c
       JOIN pedidos p ON c.pedido_id = p.id
       JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Comprobante no encontrado');
    }

    return result.rows[0];
  }

  async crear({ pedido_id, tipo, serie, correlativo, ruc_cliente, razon_social, usuario_id }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Obtener total del pedido
      const pedidoResult = await pool.query(
        `SELECT total_calculado FROM vista_total_pedidos WHERE pedido_id = $1`,
        [pedido_id]
      );

      if (pedidoResult.rows.length === 0) {
        throw new Error('Pedido no encontrado');
      }

      const total = parseFloat(pedidoResult.rows[0].total_calculado);
      const igv = tipo === 'factura' ? total * 0.18 : 0;
      const subtotal = total - igv;

      const result = await client.query(
        `INSERT INTO comprobantes 
         (pedido_id, tipo, serie, correlativo, ruc_cliente, razon_social, subtotal, igv, total, usuario_id) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
        [pedido_id, tipo, serie, correlativo, ruc_cliente || null, razon_social || null, subtotal, igv, total, usuario_id]
      );

      await client.query('COMMIT');

      return result.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async anular(id, usuario_id) {
    const result = await pool.query(
      `UPDATE comprobantes 
       SET estado = 'anulado' 
       WHERE id = $1 AND estado = 'emitido' 
       RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Comprobante no encontrado o ya está anulado');
    }

    return result.rows[0];
  }

  async obtenerCorrelativoNext(serie) {
    const result = await pool.query(
      `SELECT COALESCE(MAX(correlativo), 0) + 1 as next_correlativo 
       FROM comprobantes 
       WHERE serie = $1`,
      [serie]
    );

    return result.rows[0].next_correlativo;
  }
}

module.exports = new ComprobantesService();