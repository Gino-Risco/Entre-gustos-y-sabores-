const { query, TABLE } = require('../config/database');
const AppError = require('../utils/AppError');

// 1. Obtener todas las alertas dinámicamente
async function getAll() {
  // Buscamos directamente en la tabla productos aquellos que necesitan ayuda
  const result = await query(
    `SELECT 
        p.id as producto_id, 
        p.id, -- Dejamos el ID normal por compatibilidad
        p.nombre as producto_nombre, 
        p.nombre, 
        p.stock_actual, 
        p.stock_minimo, 
        p.unidad_medida, 
        c.nombre as categoria_nombre,
        CASE 
          WHEN p.stock_actual <= 0 THEN 'stock_negativo' 
          ELSE 'stock_bajo' 
        END as tipo
     FROM ${TABLE.PRODUCTOS} p
     LEFT JOIN ${TABLE.CATEGORIAS} c ON p.categoria_id = c.id
     WHERE p.control_stock = TRUE 
       AND p.stock_actual <= p.stock_minimo 
       AND p.activo = TRUE
     ORDER BY p.stock_actual ASC`
  );
  
  return result.rows;
}

// 2. Obtener los de stock bajo (Reutilizamos la función anterior para ser eficientes)
async function getStockBajo() {
  return await getAll();
}

// 3. Marcar como atendida
// Como hablamos de la UX, no queremos que se "borre" la alerta si aún no hay stock.
// Dejamos la función para que tu ruta no tire error 404, pero el sistema es inteligente.
async function marcarAtendida(id) {
  return { 
    success: true, 
    mensaje: "La alerta se cerrará automáticamente en el sistema cuando registres la compra del insumo." 
  };
}

module.exports = {
  getAll,
  getStockBajo,
  marcarAtendida
};