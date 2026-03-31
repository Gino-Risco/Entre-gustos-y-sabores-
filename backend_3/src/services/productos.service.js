const { query, TABLE } = require('../config/database');
const AppError = require('../utils/AppError');

async function getAllProductos(filtros = {}) {
  const { tipo, categoria_id, control_stock, activo, incluir_inactivos, disponible_en_menu } = filtros;
  
  // Convertir strings a booleanos si es necesario
  const isIncluirInactivos = incluir_inactivos === 'true' || incluir_inactivos === true;
  const isControlStock = control_stock === 'true' || control_stock === true;
  const isDisponibleEnMenu = disponible_en_menu === 'true' || disponible_en_menu === true;
  const isActivo = activo === 'true' || activo === true;
  
  let conditions = [];
  if (!isIncluirInactivos) {
    conditions.push('p.activo = TRUE');
  }
  const params = [];
  let paramIndex = 1;

  if (tipo && tipo !== '') {
    conditions.push(`p.tipo = $${paramIndex}`);
    params.push(tipo);
    paramIndex++;
  }

  if (categoria_id && categoria_id !== '') {
    conditions.push(`p.categoria_id = $${paramIndex}`);
    params.push(parseInt(categoria_id, 10));
    paramIndex++;
  }

  if (control_stock !== undefined && control_stock !== '') {
    conditions.push(`p.control_stock = $${paramIndex}`);
    params.push(isControlStock);
    paramIndex++;
  }
  
  if (disponible_en_menu !== undefined && disponible_en_menu !== '') {
    conditions.push(`p.disponible_en_menu = $${paramIndex}`);
    params.push(isDisponibleEnMenu);
    paramIndex++;
  }
  
  if (activo !== undefined && activo !== '') {
    conditions.push(`p.activo = $${paramIndex}`);
    params.push(isActivo);
    paramIndex++;
  }

  const whereClause = conditions.length > 0 ? conditions.join(' AND ') : 'TRUE';

  const result = await query(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM ${TABLE.PRODUCTOS} p
     JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE ${whereClause}
     ORDER BY p.nombre ASC`,
    params
  );

  return result.rows;
}

async function getProductById(id) {
  const result = await query(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM ${TABLE.PRODUCTOS} p
     JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE p.id = $1`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Producto no encontrado');
  }

  return result.rows[0];
}

async function createProducto(data) {
  const { 
    nombre, 
    descripcion, 
    categoria_id, 
    tipo, 
    precio_venta, 
    costo_promedio, 
    control_stock, 
    stock_actual, 
    stock_minimo, 
    permite_stock_negativo, 
    unidad_medida,
    disponible_en_menu,
    imagen_url // <-- AÑADIDO: Extraemos la URL de la imagen
  } = data;

  const isControlStock = control_stock === 'true' || control_stock === true;
  const isPermiteStockNegativo = permite_stock_negativo === 'true' || permite_stock_negativo === true;
  const isDisponibleEnMenu = disponible_en_menu === 'true' || disponible_en_menu === true;

  const catId = parseInt(categoria_id, 10);
  if (isNaN(catId)) {
    throw AppError.badRequest('Debe seleccionar una categoría válida');
  }

  const safeFloat = (val) => { const n = parseFloat(val); return isNaN(n) ? 0 : n; };
  const safeIntZero = (val) => { const n = parseInt(val, 10); return isNaN(n) ? 0 : n; };

  // <-- AÑADIDO: imagen_url y el parámetro $13 en el INSERT
  const result = await query(
    `INSERT INTO ${TABLE.PRODUCTOS} 
     (nombre, descripcion, categoria_id, tipo, precio_venta, costo_promedio, control_stock, 
      stock_actual, stock_minimo, permite_stock_negativo, unidad_medida, activo, disponible_en_menu, imagen_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, TRUE, $12, $13)
     RETURNING *`,
    [
      nombre, 
      descripcion || null, 
      catId, 
      tipo, 
      safeFloat(precio_venta), 
      safeFloat(costo_promedio), 
      isControlStock, 
      safeIntZero(stock_actual), 
      safeIntZero(stock_minimo), 
      isPermiteStockNegativo, 
      unidad_medida || 'unidad',
      isDisponibleEnMenu,
      imagen_url || null // <-- AÑADIDO: Mandamos la URL o null si no hay foto
    ]
  );

  if (result.rows.length === 0) {
    throw AppError.badRequest('No se pudo crear el producto');
  }

  return result.rows[0];
}

async function updateProducto(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const typeConversions = {
    categoria_id: (v) => parseInt(v, 10),
    precio_venta: (v) => parseFloat(v),
    costo_promedio: (v) => parseFloat(v),
    stock_actual: (v) => parseInt(v, 10),
    stock_minimo: (v) => parseInt(v, 10),
    control_stock: (v) => v === 'true' || v === true,
    permite_stock_negativo: (v) => v === 'true' || v === true,
    activo: (v) => v === 'true' || v === true,
    disponible_en_menu: (v) => v === 'true' || v === true,
  };

  Object.keys(data).forEach((key) => {
    if (['id', 'created_at', 'updated_at'].includes(key)) return;
    
    fields.push(`${key} = $${paramIndex}`);
    
    let value = data[key];
    if (typeConversions[key]) {
      value = typeConversions[key](value);
      if (typeof value === 'number' && isNaN(value)) {
         value = 0; 
      }
    }
    
    values.push(value);
    paramIndex++;
  });

  if (fields.length === 0) {
    throw AppError.badRequest('No hay campos para actualizar');
  }

  values.push(id);
  
  const result = await query(
    `UPDATE ${TABLE.PRODUCTOS} 
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Producto no encontrado');
  }

  return result.rows[0];
}

async function toggleActivo(id, activo) {
  const result = await query(
    `UPDATE ${TABLE.PRODUCTOS} 
     SET activo = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [activo, id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Producto no encontrado');
  }

  return result.rows[0];
}

async function toggleDisponibleEnMenu(id, disponible_en_menu) {
  const result = await query(
    `UPDATE ${TABLE.PRODUCTOS} 
     SET disponible_en_menu = $1, updated_at = NOW()
     WHERE id = $2
     RETURNING *`,
    [disponible_en_menu, id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Producto no encontrado');
  }

  return result.rows[0];
}

async function deleteProducto(id) {
  const result = await query(
    `UPDATE ${TABLE.PRODUCTOS} 
     SET activo = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Producto no encontrado');
  }

  return { id };
}

async function getStockBajo() {
  const result = await query(
    `SELECT * FROM inventario.v_stock_bajo`
  );
  return result.rows;
}

async function getProductosParaMenu() {
  const result = await query(
    `SELECT p.*, c.nombre AS categoria_nombre
     FROM ${TABLE.PRODUCTOS} p
     JOIN ${TABLE.CATEGORIAS} c ON c.id = p.categoria_id
     WHERE p.disponible_en_menu = TRUE 
       AND p.activo = TRUE
       AND (p.tipo = 'preparado' OR p.tipo = 'entrada' OR p.tipo = 'fondo')
     ORDER BY c.nombre, p.nombre ASC`
  );
  
  return result.rows;
}

module.exports = {
  getAllProductos,
  getProductById,
  createProducto,
  updateProducto,
  deleteProducto,
  getStockBajo,
  toggleActivo,
  toggleDisponibleEnMenu,
  getProductosParaMenu,
};