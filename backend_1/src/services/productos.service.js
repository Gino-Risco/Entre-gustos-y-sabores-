const pool = require('../config/db');

class ProductosService {
  async obtenerTodos() {
    const result = await pool.query(
      `SELECT 
        p.*,
        c.nombre as categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.activo = true
       ORDER BY c.orden_mostrar, p.nombre`
    );
    return result.rows;
  }

  async obtenerPorId(id) {
    const result = await pool.query(
      `SELECT 
        p.*,
        c.nombre as categoria_nombre
       FROM productos p
       LEFT JOIN categorias c ON p.categoria_id = c.id
       WHERE p.id = $1 AND p.activo = true`,
      [id]
    );
    if (result.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }
    return result.rows[0];
  }

  async obtenerPorCategoria(categoria_id) {
    const result = await pool.query(
      `SELECT * FROM productos 
       WHERE categoria_id = $1 AND activo = true 
       ORDER BY nombre`,
      [categoria_id]
    );
    return result.rows;
  }

  async crear({ nombre, descripcion, precio_venta, costo_promedio, tipo, requiere_cocina, categoria_id }) {
    const existe = await pool.query(
      'SELECT id FROM productos WHERE nombre = $1 AND activo = true',
      [nombre]
    );

    if (existe.rows.length > 0) {
      throw new Error('Ya existe un producto con ese nombre');
    }

    const result = await pool.query(
      `INSERT INTO productos 
       (nombre, descripcion, precio_venta, costo_promedio, tipo, requiere_cocina, categoria_id, activo) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [nombre, descripcion || null, precio_venta, costo_promedio || 0, tipo || 'plato', requiere_cocina ?? true, categoria_id, true]
    );
    return result.rows[0];
  }

  async actualizar(id, { nombre, descripcion, precio_venta, costo_promedio, tipo, requiere_cocina, categoria_id }) {
    const result = await pool.query(
      `UPDATE productos 
       SET nombre = COALESCE($1, nombre), 
           descripcion = COALESCE($2, descripcion), 
           precio_venta = COALESCE($3, precio_venta), 
           costo_promedio = COALESCE($4, costo_promedio),
           tipo = COALESCE($5, tipo),
           requiere_cocina = COALESCE($6, requiere_cocina),
           categoria_id = COALESCE($7, categoria_id)
       WHERE id = $8 AND activo = true 
       RETURNING *`,
      [nombre, descripcion, precio_venta, costo_promedio, tipo, requiere_cocina, categoria_id, id]
    );

    if (result.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }
    return result.rows[0];
  }

  async eliminar(id) {
    // Verificar si tiene recetas asociadas
    const recetas = await pool.query(
      'SELECT COUNT(*) as count FROM recetas WHERE producto_id = $1',
      [id]
    );

    if (parseInt(recetas.rows[0].count) > 0) {
      throw new Error('No se puede eliminar. El producto tiene recetas asociadas.');
    }

    // Verificar si tiene pedidos asociados
    const pedidos = await pool.query(
      'SELECT COUNT(*) as count FROM pedido_detalles WHERE producto_id = $1',
      [id]
    );

    if (parseInt(pedidos.rows[0].count) > 0) {
      throw new Error('No se puede eliminar. El producto tiene pedidos históricos.');
    }

    const result = await pool.query(
      `UPDATE productos 
       SET activo = false, fecha_eliminacion = CURRENT_TIMESTAMP 
       WHERE id = $1 RETURNING *`,
      [id]
    );

    if (result.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }
    return result.rows[0];
  }

  // Gestión de recetas
  async obtenerReceta(producto_id) {
    const result = await pool.query(
      `SELECT 
        r.*,
        i.nombre as insumo_nombre,
        i.unidad_medida,
        i.stock_actual
       FROM recetas r
       JOIN insumos i ON r.insumo_id = i.id
       WHERE r.producto_id = $1`,
      [producto_id]
    );
    return result.rows;
  }

  async agregarReceta(producto_id, insumo_id, cantidad_requerida, unidad_medida_receta) {
    // Verificar producto
    const producto = await pool.query(
      'SELECT id FROM productos WHERE id = $1 AND activo = true',
      [producto_id]
    );

    if (producto.rows.length === 0) {
      throw new Error('Producto no encontrado');
    }

    // Verificar insumo
    const insumo = await pool.query(
      'SELECT id FROM insumos WHERE id = $1 AND activo = true',
      [insumo_id]
    );

    if (insumo.rows.length === 0) {
      throw new Error('Insumo no encontrado');
    }

    const result = await pool.query(
      `INSERT INTO recetas (producto_id, insumo_id, cantidad_requerida, unidad_medida_receta) 
       VALUES ($1, $2, $3, $4) 
       ON CONFLICT (producto_id, insumo_id) 
       DO UPDATE SET cantidad_requerida = $3, unidad_medida_receta = $4
       RETURNING *`,
      [producto_id, insumo_id, cantidad_requerida, unidad_medida_receta]
    );

    return result.rows[0];
  }

  async eliminarReceta(producto_id, insumo_id) {
    const result = await pool.query(
      'DELETE FROM recetas WHERE producto_id = $1 AND insumo_id = $2 RETURNING *',
      [producto_id, insumo_id]
    );

    if (result.rows.length === 0) {
      throw new Error('Receta no encontrada');
    }
    return result.rows[0];
  }
}

module.exports = new ProductosService();