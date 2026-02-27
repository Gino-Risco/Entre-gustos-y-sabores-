const categoriasService = require('../services/categorias.service');

const categoriasController = {
  obtenerTodas: async (req, res) => {
    try {
      const categorias = await categoriasService.obtenerTodas();
      res.json({ success: true,  categorias });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const categoria = await categoriasService.obtenerPorId(req.params.id);
      res.json({ success: true,  categoria });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  crear: async (req, res) => {
    try {
      const { nombre, descripcion, orden_mostrar } = req.body;
      const categoria = await categoriasService.crear({ nombre, descripcion, orden_mostrar });
      res.status(201).json({ success: true,  categoria });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  actualizar: async (req, res) => {
    try {
      const categoria = await categoriasService.actualizar(req.params.id, req.body);
      res.json({ success: true,  categoria });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  eliminar: async (req, res) => {
    try {
      await categoriasService.eliminar(req.params.id);
      res.json({ success: true, message: 'Categoría eliminada correctamente' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

module.exports = categoriasController;