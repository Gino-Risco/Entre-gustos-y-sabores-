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

// En services/reportes.service.js

async function getDashboardResumen(fecha_desde) {
  // Si no viene fecha, usamos el día actual en Perú
  const fechaConsulta = fecha_desde || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });

  const ventasHoyResult = await query(
    `SELECT 
            COUNT(*) AS total_ventas,
            COALESCE(SUM(total), 0) AS total_ingresos,
            COALESCE(AVG(total), 0) AS ticket_promedio
     FROM pos.ventas
     -- FORZAMOS EL RANGO HORARIO DE PERÚ
    WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima')::date = $1::date
       AND activo = TRUE`,
    [fechaConsulta]
  );

  // 2. VENTAS DE AYER (Le restamos 1 día a la fecha consultada)
  const ventasAyerResult = await query(
    `SELECT 
            COALESCE(SUM(total), 0) AS total_ingresos
     FROM pos.ventas
     WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima')::date = ($1::date - INTERVAL '1 day')::date
       AND activo = TRUE`,
    [fechaConsulta]
  );

  // 3. MATEMÁTICA SENIOR: Calcular el porcentaje de crecimiento
  const ingresosHoy = parseFloat(ventasHoyResult.rows[0].total_ingresos);
  const ingresosAyer = parseFloat(ventasAyerResult.rows[0].total_ingresos);

  let crecimiento_porcentaje = 0;
  let tendencia = 'neutral'; // puede ser: 'sube', 'baja', 'neutral'

  if (ingresosAyer > 0) {
    // Fórmula clásica: ((Hoy - Ayer) / Ayer) * 100
    crecimiento_porcentaje = ((ingresosHoy - ingresosAyer) / ingresosAyer) * 100;
  } else if (ingresosAyer === 0 && ingresosHoy > 0) {
    // Si ayer no vendió nada y hoy sí, subió al 100%
    crecimiento_porcentaje = 100;
  }

  // Definimos la tendencia para facilitarle la vida al Frontend
  if (crecimiento_porcentaje > 0) tendencia = 'sube';
  else if (crecimiento_porcentaje < 0) tendencia = 'baja';

  // 2. Productos con stock bajo
  const stockBajoResult = await query(
    `SELECT COUNT(*) AS total FROM inventario.v_stock_bajo`
  );

  // 3. Alertas pendientes
  const alertasResult = await query(
    `SELECT COUNT(*) AS total FROM inventario.v_alertas_pendientes`
  );

  // 4. Caja abierta
  const cajaAbiertaResult = await query(
    `SELECT COUNT(*) AS total FROM pos.caja_aperturas WHERE estado = 'abierta' AND activo = TRUE`
  );

  // 5. Órdenes activas
  const ordenesActivasResult = await query(
    `SELECT COUNT(*) AS total FROM pos.ordenes 
     WHERE estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista') 
     AND activo = TRUE`
  );

  return {
    ventas: ventasHoyResult.rows[0],
    comparacion_ventas: {
      porcentaje: Math.abs(crecimiento_porcentaje).toFixed(1), // Math.abs quita el signo negativo
      tendencia: tendencia, // 'sube', 'baja' o 'neutral'
      texto: `${Math.abs(crecimiento_porcentaje).toFixed(1)}% vs ayer`
    },
    stock_bajo: stockBajoResult.rows[0].total,
    alertas_pendientes: alertasResult.rows[0].total,
    caja_abierta: cajaAbiertaResult.rows[0].total > 0,
    ordenes_activas: ordenesActivasResult.rows[0].total,

  };
}

/**
 * Ventas por hora del día (para gráfico de línea)
 * @param {string} fecha - Fecha en formato YYYY-MM-DD (opcional, default: hoy)
 */
// En services/reportes.service.js -> getVentasPorHora
async function getVentasPorHora(fecha) {
  const fechaConsulta = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });

  const result = await query(
    `SELECT 
       -- Extraemos la hora ajustada a nuestra zona horaria para el gráfico
       EXTRACT(HOUR FROM created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima') AS hora,
       COUNT(*) AS total_ventas,
       COALESCE(SUM(total), 0) AS total_ingresos
     FROM pos.ventas
     WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima')::date = $1::date
       AND activo = TRUE
     GROUP BY 1
     ORDER BY hora ASC`,
    [fechaConsulta]
  );

  // Completar horas sin ventas con 0 para gráfico continuo
  const horasCompletas = [];
  for (let h = 0; h < 24; h++) {
    const horaData = result.rows.find(r => parseInt(r.hora) === h);
    horasCompletas.push({
      hora: h,
      hora_label: `${h.toString().padStart(2, '0')}:00`,
      total_ventas: horaData ? parseInt(horaData.total_ventas) : 0,
      total_ingresos: horaData ? parseFloat(horaData.total_ingresos) : 0
    });
  }

  return horasCompletas;
}

/**
 * Ventas por método de pago del día (para gráfico doughnut)
 * @param {string} fecha - Fecha en formato YYYY-MM-DD (opcional, default: hoy)
 */
async function getVentasPorMetodoPagoHoy(fecha) {
  const fechaConsulta = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });

  const result = await query(
    `SELECT 
        metodo_pago,
        COUNT(*) AS total_ventas,
        COALESCE(SUM(total), 0) AS total_ingresos
     FROM pos.ventas
     -- CAMBIO AQUÍ: Usamos el rango de tiempo exacto de Perú
    WHERE (created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima')::date = $1::date
       AND activo = TRUE
     GROUP BY metodo_pago
     ORDER BY total_ingresos DESC`,
    [fechaConsulta]
  );

  return result.rows.map(row => ({
    metodo: row.metodo_pago,
    label: row.metodo_pago.charAt(0).toUpperCase() + row.metodo_pago.slice(1),
    value: parseFloat(row.total_ingresos),
    count: parseInt(row.total_ventas)
  }));
}

/**
 * Top 5 productos más vendidos del día
 * @param {string} fecha - Fecha en formato YYYY-MM-DD (opcional, default: hoy)
 * @param {number} limite - Cantidad de productos a retornar (default: 5)
 */
async function getTopProductosHoy(fecha, limite = 5) {
  const fechaConsulta = fecha || new Date().toLocaleDateString('sv-SE', { timeZone: 'America/Lima' });

  const result = await query(
    `SELECT 
        p.id,
        p.nombre,
        c.nombre AS categoria,
        SUM(vd.cantidad) AS total_vendido,
        SUM(vd.subtotal) AS total_ingresos
     FROM pos.ventas_detalle vd
     JOIN inventario.productos p ON p.id = vd.producto_id
     JOIN inventario.categorias c ON c.id = p.categoria_id
     JOIN pos.ventas v ON v.id = vd.venta_id
     WHERE (v.created_at AT TIME ZONE 'UTC' AT TIME ZONE 'America/Lima')::date = $1::date
       AND v.activo = TRUE
       AND vd.activo = TRUE
       AND vd.es_incluido_menu = FALSE
     GROUP BY p.id, p.nombre, c.nombre
     ORDER BY total_vendido DESC
     LIMIT $2`,
    [fechaConsulta, limite]
  );

  return result.rows.map(row => ({
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria,
    vendido: parseInt(row.total_vendido),
    ingresos: parseFloat(row.total_ingresos)
  }));
}
/**
 * Últimas órdenes activas (para lista en dashboard)
 * @param {number} limite - Cantidad de órdenes a retornar (default: 5)
 */
// En services/reportes.service.js -> getUltimasOrdenesActivas
async function getUltimasOrdenesActivas(limite = 5) {
  const result = await query(
    `SELECT 
       o.id,
       o.numero_comanda,
       o.estado,
       o.tipo_pedido,
       o.nombre_cliente,
       m.numero AS mesa_numero,
       u.nombre AS mesero,
       o.created_at,
       -- Calculamos el total acumulado de la orden sumando los detalles activos
       COALESCE((
         SELECT SUM(od.subtotal) 
         FROM pos.orden_detalles od 
         WHERE od.orden_id = o.id AND od.activo = TRUE
       ), 0) AS total_cobrable,
       EXTRACT(EPOCH FROM (NOW() - o.created_at)) / 60 AS minutos_abierta
     FROM pos.ordenes o
     -- CAMBIO CLAVE: LEFT JOIN permite que vengan órdenes sin mesa
     LEFT JOIN pos.mesas m ON m.id = o.mesa_id 
     JOIN pos.usuarios u ON u.id = o.mesero_id
     WHERE o.estado IN ('abierta', 'enviada_cocina', 'preparando', 'lista')
       AND o.activo = TRUE
     ORDER BY o.created_at DESC
     LIMIT $1`,
    [limite]
  );

  return result.rows.map(row => ({
    id: row.id,
    comanda: row.numero_comanda,
    estado: row.estado,
    tipo: row.tipo_pedido,
    cliente: row.nombre_cliente,
    mesa: row.mesa_numero, // Número de mesa
    mesero: row.mesero,
    hora: row.created_at,
    minutos: Math.round(parseFloat(row.minutos_abierta)),
    total: parseFloat(row.total_cobrable) // Nuevo campo: Monto acumulado
  }));
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
  getVentasPorHora,
  getVentasPorMetodoPagoHoy,
  getTopProductosHoy,
  getUltimasOrdenesActivas
};