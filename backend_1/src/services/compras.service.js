const pool = require('../config/db');

class ComprasService {
  async obtenerTodas() {
    const result = await pool.query(
      `SELECT 
        c.*,
        p.nombre_empresa as proveedor_nombre,
        u.nombre_completo as usuario_nombre
       FROM compras c
       JOIN proveedores p ON c.proveedor_id = p.id
       JOIN usuarios u ON c.usuario_id = u.id
       ORDER BY c.fecha_compra DESC`
    );
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      `SELECT 
        c.*,
        p.nombre_empresa as proveedor_nombre,
        u.nombre_completo as usuario_nombre
       FROM compras c
       JOIN proveedores p ON c.proveedor_id = p.id
       JOIN usuarios u ON c.usuario_id = u.id
       WHERE c.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Compra no encontrada');
    }

    const compra = result.rows[0];

    // Obtener detalles
    const detallesResult = await pool.query(
      `SELECT 
        cd.*,
        i.nombre as insumo_nombre,
        i.unidad_medida
       FROM compras_detalles cd
       JOIN insumos i ON cd.insumo_id = i.id
       WHERE cd.compra_id = $1`,
      [id]
    );

    return {
      ...compra,
      detalles: detallesResult.rows
    };
  }

  async crear({ proveedor_id, usuario_id, numero_comprobante, detalles, notas }) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Calcular totales
      const subtotal = detalles.reduce((sum, d) => sum + parseFloat(d.subtotal), 0);
      const impuestos = subtotal * 0.18; // IGV 18%
      const total = subtotal + impuestos;

      // Crear compra en estado 'pendiente'
      const compraResult = await client.query(
        `INSERT INTO compras 
         (proveedor_id, usuario_id, subtotal, impuestos, total, numero_comprobante, estado, notas) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [proveedor_id, usuario_id, subtotal, impuestos, total, numero_comprobante || null, 'pendiente', notas || null]
      );

      const compra = compraResult.rows[0];

      // Insertar detalles
      for (const detalle of detalles) {
        await client.query(
          `INSERT INTO compras_detalles (compra_id, insumo_id, cantidad, costo_unitario, subtotal) 
           VALUES ($1, $2, $3, $4, $5)`,
          [compra.id, detalle.insumo_id, detalle.cantidad, detalle.costo_unitario, detalle.subtotal]
        );
      }

      await client.query('COMMIT');

      return await this.obtenerPorId(compra.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async completarCompra(compra_id, usuario_id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que la compra existe y está pendiente
      const compraResult = await client.query(
        "SELECT * FROM compras WHERE id = $1 AND estado = 'pendiente'",
        [compra_id]
      );

      if (compraResult.rows.length === 0) {
        throw new Error('Compra no encontrada o ya está completada');
      }

      // Actualizar a completada (el trigger fn_compra_detalle_entrada hará el resto)
      const result = await client.query(
        `UPDATE compras 
         SET estado = 'completada' 
         WHERE id = $1 RETURNING *`,
        [compra_id]
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

  async cancelarCompra(compra_id, usuario_id) {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const compraResult = await client.query(
        "SELECT * FROM compras WHERE id = $1 AND estado = 'pendiente'",
        [compra_id]
      );

      if (compraResult.rows.length === 0) {
        throw new Error('Compra no encontrada o ya está completada');
      }

      const result = await client.query(
        `UPDATE compras 
         SET estado = 'cancelada' 
         WHERE id = $1 RETURNING *`,
        [compra_id]
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
}

module.exports = new ComprasService();