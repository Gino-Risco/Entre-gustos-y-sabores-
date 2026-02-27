const productosService = require('../services/productos.service');

const productosController = {
  obtenerTodos: async (req, res) => {
    try {
      const productos = await productosService.obtenerTodos();
      res.json({ success: true,  productos });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const producto = await productosService.obtenerPorId(req.params.id);
      res.json({ success: true,  producto });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  obtenerPorCategoria: async (req, res) => {
    try {
      const productos = await productosService.obtenerPorCategoria(req.params.categoria_id);
      res.json({ success: true,  productos });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  crear: async (req, res) => {
    try {
      const { nombre, descripcion, precio_venta, costo_promedio, tipo, requiere_cocina, categoria_id } = req.body;
      const producto = await productosService.crear({ nombre, descripcion, precio_venta, costo_promedio, tipo, requiere_cocina, categoria_id });
      res.status(201).json({ success: true, data: producto });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  actualizar: async (req, res) => {
    try {
      const producto = await productosService.actualizar(req.params.id, req.body);
      res.json({ success: true, data: producto });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  eliminar: async (req, res) => {
    try {
      await productosService.eliminar(req.params.id);
      res.json({ success: true, message: 'Producto eliminado correctamente' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  // Recetas
  obtenerReceta: async (req, res) => {
    try {
      const receta = await productosService.obtenerReceta(req.params.id);
      res.json({ success: true,  receta });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  agregarReceta: async (req, res) => {
    try {
      const { insumo_id, cantidad_requerida, unidad_medida_receta } = req.body;
      const receta = await productosService.agregarReceta(req.params.id, insumo_id, cantidad_requerida, unidad_medida_receta);
      res.status(201).json({ success: true, data: receta });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  eliminarReceta: async (req, res) => {
    try {
      const { insumo_id } = req.params;
      await productosService.eliminarReceta(req.params.id, insumo_id);
      res.json({ success: true, message: 'Ingrediente eliminado de la receta' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

module.exports = productosController;