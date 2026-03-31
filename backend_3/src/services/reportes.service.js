const { query } = require('../config/database');

async function getVentasPorPeriodo(fecha_desde, fecha_hasta, agrupar_por = 'dia') {
  let fechaFormat = '';
  
  switch (agrupar_por) {
    case 'dia':
      fechaFormat = "DATE_TRUNC('day', v.created_at)";
      break;
    case 'semana':
      fechaFormat = "DATE_TRUNC('week', v.created_at)";
      break;
    case 'mes':
      fechaFormat = "DATE_TRUNC('month', v.created_at)";
      break;
    default:
      fechaFormat = "DATE_TRUNC('day', v.created_at)";
  }

  const result = await query(
    `SELECT 
            ${fechaFormat} AS periodo,
            COUNT(v.id) AS total_ventas,
            SUM(v.total) AS total_ingresos,
            SUM(v.descuento) AS total_descuentos,
            AVG(v.total) AS ticket_promedio,
            COUNT(DISTINCT v.cajero_id) AS cajeros_activos
     FROM pos.ventas v
     WHERE v.created_at >= $1 
       AND v.created_at <= $2
       AND v.activo = TRUE
     GROUP BY ${fechaFormat}
     ORDER BY periodo ASC`,
    [fecha_desde, fecha_hasta]
  );

  return result.rows;
}

async function getProductosMasVendidos(fecha_desde, fecha_hasta, limite = 20) {
  const result = await query(
    `SELECT * FROM inventario.v_productos_mas_vendidos
     LIMIT $1`,
    [limite]
  );

  // Filtrar por fecha manualmente ya que la vista no tiene filtro
  const resultWithFilter = await query(
    `SELECT 
            p.id,
            p.nombre,
            p.tipo,
            c.nombre AS categoria,
            SUM(vd.cantidad) AS total_vendido,
            SUM(vd.subtotal) AS total_ingresos,
            p.stock_actual
     FROM pos.ventas_detalle vd
     JOIN inventario.productos p ON p.id = vd.producto_id
     JOIN inventario.categorias c ON c.id = p.categoria_id
     JOIN pos.ventas v ON v.id = vd.venta_id
     WHERE v.created_at >= $1 
       AND v.created_at <= $2
       AND v.activo = TRUE
       AND vd.activo = TRUE
       AND vd.es_incluido_menu = FALSE
     GROUP BY p.id, p.nombre, p.tipo, c.nombre, p.stock_actual
     ORDER BY total_vendido DESC
     LIMIT $3`,
    [fecha_desde, fecha_hasta, limite]
  );

  return resultWithFilter.rows;
}

async function getVentasPorCategoria(fecha_desde, fecha_hasta) {
  const result = await query(
    `SELECT 
            c.nombre AS categoria,
            c.tipo,
            COUNT(vd.id) AS total_items_vendidos,
            SUM(vd.cantidad) AS total_cantidad,
            SUM(vd.subtotal) AS total_ingresos
     FROM pos.ventas_detalle vd
     JOIN inventario.productos p ON p.id = vd.producto_id
     JOIN inventario.categorias c ON c.id = p.categoria_id
     JOIN pos.ventas v ON v.id = vd.venta_id
     WHERE v.created_at >= $1 
       AND v.created_at <= $2
       AND v.activo = TRUE
       AND vd.activo = TRUE
       AND vd.es_incluido_menu = FALSE
     GROUP BY c.id, c.nombre, c.tipo
     ORDER BY total_ingresos DESC`,
    [fecha_desde, fecha_hasta]
  );

  return result.rows;
}

async function getVentasPorMetodoPago(fecha_desde, fecha_hasta) {
  const result = await query(
    `SELECT 
            v.metodo_pago,
            COUNT(v.id) AS total_ventas,
            SUM(v.total) AS total_ingresos,
            AVG(v.total) AS ticket_promedio
     FROM pos.ventas v
     WHERE v.created_at >= $1 
       AND v.created_at <= $2
       AND v.activo = TRUE
     GROUP BY v.metodo_pago
     ORDER BY total_ingresos DESC`,
    [fecha_desde, fecha_hasta]
  );

  return result.rows;
}

async function getVentasPorMesa(fecha_desde, fecha_hasta) {
  const result = await query(
    `SELECT 
            m.id AS mesa_id,
            m.numero AS mesa_numero,
            COUNT(v.id) AS total_ventas,
            SUM(v.total) AS total_ingresos,
            AVG(v.total) AS ticket_promedio
     FROM pos.ventas v
     JOIN pos.ordenes o ON o.id = v.orden_id
     JOIN pos.mesas m ON m.id = o.mesa_id
     WHERE v.created_at >= $1 
       AND v.created_at <= $2
       AND v.activo = TRUE
       AND o.activo = TRUE
     GROUP BY m.id, m.numero
     ORDER BY total_ingresos DESC`,
    [fecha_desde, fecha_hasta]
  );

  return result.rows;
}

async function getVentasPorMesero(fecha_desde, fecha_hasta) {
  const result = await query(
    `SELECT 
            u.id AS mesero_id,
            u.nombre AS mesero_nombre,
            COUNT(o.id) AS total_ordenes,
            COUNT(v.id) AS total_ventas,
            COALESCE(SUM(v.total), 0) AS total_ingresos
     FROM pos.usuarios u
     JOIN pos.roles r ON r.id = u.rol_id
     LEFT JOIN pos.ordenes o ON o.mesero_id = u.id AND o.activo = TRUE
     LEFT JOIN pos.ventas v ON v.orden_id = o.id AND v.activo = TRUE
     WHERE r.nombre = 'mesero'
       AND u.activo = TRUE
       AND (v.created_at >= $1 AND v.created_at <= $2 OR v.created_at IS NULL)
     GROUP BY u.id, u.nombre
     ORDER BY total_ingresos DESC`,
    [fecha_desde, fecha_hasta]
  );

  return result.rows;
}

async function getCajaReporte(fecha) {
  const result = await query(
    `SELECT * FROM pos.v_caja_dia WHERE fecha_apertura::date = $1`,
    [fecha || new Date().toISOString().split('T')[0]]
  );

  return result.rows;
}

async function getAlertasStockPendientes() {
  const result = await query(
    `SELECT * FROM inventario.v_alertas_pendientes`
  );

  return result.rows;
}

async function getDashboardResumen(fecha_desde, fecha_hasta) {
  // Ventas del período
  const ventasResult = await query(
    `SELECT 
            COUNT(*) AS total_ventas,
            COALESCE(SUM(total), 0) AS total_ingresos,
            COALESCE(AVG(total), 0) AS ticket_promedio
     FROM pos.ventas
     WHERE created_at >= $1 AND created_at <= $2 AND activo = TRUE`,
    [fecha_desde, fecha_hasta]
  );

  // Productos con stock bajo
  const stockBajoResult = await query(
    `SELECT COUNT(*) AS total FROM inventario.v_stock_bajo`
  );

  // Alertas pendientes
  const alertasResult = await query(
    `SELECT COUNT(*) AS total FROM inventario.v_alertas_pendientes`
  );

  // Caja abierta
  const cajaAbiertaResult = await query(
    `SELECT COUNT(*) AS total FROM pos.caja_aperturas WHERE estado = 'abierta' AND activo = TRUE`
  );

  // Órdenes activas
  const ordenesActivasResult = await query(
    `SELECT COUNT(*) AS total FROM pos.ordenes WHERE estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista') AND activo = TRUE`
  );

  return {
    ventas: ventasResult.rows[0],
    stock_bajo: stockBajoResult.rows[0].total,
    alertas_pendientes: alertasResult.rows[0].total,
    caja_abierta: cajaAbiertaResult.rows[0].total > 0,
    ordenes_activas: ordenesActivasResult.rows[0].total,
  };
}

module.exports = {
  getVentasPorPeriodo,
  getProductosMasVendidos,
  getVentasPorCategoria,
  getVentasPorMetodoPago,
  getVentasPorMesa,
  getVentasPorMesero,
  getCajaReporte,
  getAlertasStockPendientes,
  getDashboardResumen,
};