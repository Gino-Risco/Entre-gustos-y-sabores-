const { query, TABLE } = require('../config/database');
const AppError = require('../utils/AppError');

async function getAllCategorias(filtros = {}) {
  // filters currently support `activo` only; `tipo` was removed since
  // product types are handled on the product side, not on categories.
  const { activo } = filtros;
  
  const conditions = ['c.activo = TRUE'];
  const params = [];
  let paramIndex = 1;

  if (activo !== undefined) {
    conditions.push(`c.activo = $${paramIndex}`);
    params.push(activo);
    paramIndex++;
  }

  const whereClause = conditions.join(' AND ');

  const result = await query(
    `SELECT * FROM ${TABLE.CATEGORIAS} c WHERE ${whereClause} ORDER BY c.nombre ASC`,
    params
  );

  return result.rows;
}

async function getCategoriaById(id) {
  const result = await query(
    `SELECT * FROM ${TABLE.CATEGORIAS} WHERE id = $1 AND activo = TRUE`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Categoría no encontrada');
  }

  return result.rows[0];
}

async function createCategoria(data) {
  // categoria object arriving from UI only contains name, description and
  // a color picker. The `tipo` field was a leftover from the initial
  // implementation and conflicted with product.tipo. We no longer expect it.
  const { nombre, descripcion, color } = data;

  // Validar que no exista nombre duplicado
  const existing = await query(
    `SELECT id FROM ${TABLE.CATEGORIAS} WHERE nombre = $1 AND activo = TRUE`,
    [nombre]
  );

  if (existing.rows.length > 0) {
    throw AppError.conflict('Ya existe una categoría con ese nombre');
  }

  // note: add color column if it exists in the database schema
  const result = await query(
    `INSERT INTO ${TABLE.CATEGORIAS} (nombre, descripcion, color, activo)
     VALUES ($1, $2, $3, TRUE)
     RETURNING *`,
    [nombre, descripcion || null, color || '#3b82f6']
  );

  return result.rows[0];
}

async function updateCategoria(id, data) {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  Object.keys(data).forEach((key) => {
    if (['id', 'created_at', 'updated_at'].includes(key)) return;
    fields.push(`${key} = $${paramIndex}`);
    values.push(data[key]);
    paramIndex++;
  });

  if (fields.length === 0) {
    throw AppError.badRequest('No hay campos para actualizar');
  }

  // Validar nombre único si se está cambiando
  if (data.nombre) {
    const existing = await query(
      `SELECT id FROM ${TABLE.CATEGORIAS} WHERE nombre = $1 AND id <> $2 AND activo = TRUE`,
      [data.nombre, id]
    );

    if (existing.rows.length > 0) {
      throw AppError.conflict('Ya existe una categoría con ese nombre');
    }
  }

  values.push(id);
  
  const result = await query(
    `UPDATE ${TABLE.CATEGORIAS} 
     SET ${fields.join(', ')}, updated_at = NOW()
     WHERE id = $${paramIndex}
     RETURNING *`,
    values
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Categoría no encontrada');
  }

  return result.rows[0];
}

async function deleteCategoria(id) {
  // Verificar si hay productos usando esta categoría
  const productos = await query(
    `SELECT COUNT(*) as count FROM ${TABLE.PRODUCTOS} WHERE categoria_id = $1 AND activo = TRUE`,
    [id]
  );

  if (parseInt(productos.rows[0].count) > 0) {
    throw AppError.conflict('No se puede eliminar: hay productos asociados a esta categoría');
  }

  const result = await query(
    `UPDATE ${TABLE.CATEGORIAS} 
     SET activo = FALSE, updated_at = NOW()
     WHERE id = $1
     RETURNING id`,
    [id]
  );

  if (result.rows.length === 0) {
    throw AppError.notFound('Categoría no encontrada');
  }

  return { id };
}

module.exports = {
  getAllCategorias,
  getCategoriaById,
  createCategoria,
  updateCategoria,
  deleteCategoria,
};