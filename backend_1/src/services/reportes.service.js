const pool = require('../config/db');

class ReportesService {
  async ventasPorDia(fecha_inicio, fecha_fin) {
    const result = await pool.query(
      `SELECT 
        DATE(p.fecha_apertura) as fecha,
        COUNT(p.id) as total_pedidos,
        COALESCE(SUM(vtp.subtotal_calculado - vtp.descuento_global), 0) as total_ventas,
        COUNT(DISTINCT p.mesa_id) as mesas_atendidas
       FROM pedidos p
       LEFT JOIN vista_total_pedidos vtp ON p.id = vtp.pedido_id
       WHERE p.estado = 'cerrado'
         AND p.fecha_apertura >= $1
         AND p.fecha_apertura <= $2
       GROUP BY DATE(p.fecha_apertura)
       ORDER BY fecha DESC`,
      [fecha_inicio, fecha_fin]
    );
    return result.rows;
  }

  async productosMasVendidos(fecha_inicio, fecha_fin, limite = 10) {
    const result = await pool.query(
      `SELECT 
        pr.id,
        pr.nombre,
        c.nombre as categoria,
        SUM(pd.cantidad) as cantidad_vendida,
        COALESCE(SUM(pd.subtotal - pd.descuento_item), 0) as total_ventas
       FROM pedido_detalles pd
       JOIN productos pr ON pd.producto_id = pr.id
       JOIN pedidos p ON pd.pedido_id = p.id
       LEFT JOIN categorias c ON pr.categoria_id = c.id
       WHERE p.estado = 'cerrado'
         AND pd.estado_cocina != 'cancelado'
         AND p.fecha_apertura >= $1
         AND p.fecha_apertura <= $2
       GROUP BY pr.id, pr.nombre, c.nombre
       ORDER BY cantidad_vendida DESC
       LIMIT $3`,
      [fecha_inicio, fecha_fin, limite]
    );
    return result.rows;
  }

  async ventasPorMetodoPago(fecha_inicio, fecha_fin) {
    const result = await pool.query(
      `SELECT 
        pa.metodo_pago,
        COUNT(pa.id) as total_transacciones,
        COALESCE(SUM(pa.monto), 0) as total_ventas
       FROM pagos pa
       JOIN pedidos p ON pa.pedido_id = p.id
       WHERE p.estado = 'cerrado'
         AND p.fecha_apertura >= $1
         AND p.fecha_apertura <= $2
         AND pa.anulado = false
       GROUP BY pa.metodo_pago
       ORDER BY total_ventas DESC`,
      [fecha_inicio, fecha_fin]
    );
    return result.rows;
  }

  async resumenTurno(turno_id) {
    const result = await pool.query(
      `SELECT * FROM vista_pagos_por_turno WHERE turno_id = $1`,
      [turno_id]
    );

    if (result.rows.length === 0) {
      throw new Error('Turno no encontrado');
    }
    return result.rows[0];
  }

  async stockCritico() {
    const result = await pool.query(
      `SELECT * FROM vista_alertas_stock WHERE estado_stock IN ('sin_stock', 'stock_bajo')`
    );
    return result.rows;
  }

  async inventarioValorizado() {
    const result = await pool.query(
      `SELECT 
        id,
        nombre,
        unidad_medida,
        stock_actual,
        costo_unitario_promedio,
        (stock_actual * costo_unitario_promedio) as valor_total
       FROM insumos 
       WHERE activo = true AND stock_actual > 0
       ORDER BY valor_total DESC`
    );
    return result.rows;
  }
}

module.exports = new ReportesService();