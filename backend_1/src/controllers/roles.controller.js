const rolesService = require('../services/roles.service');

const rolesController = {
  obtenerTodos: async (req, res) => {
    try {
      const roles = await rolesService.obtenerTodos();
      res.json({ success: true, data: roles });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const rol = await rolesService.obtenerPorId(req.params.id);
      res.json({ success: true, data: rol });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  crear: async (req, res) => {
    try {
      const { nombre, descripcion } = req.body;
      const rol = await rolesService.crear({ nombre, descripcion });
      res.status(201).json({ success: true, data: rol });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  actualizar: async (req, res) => {
    try {
      const rol = await rolesService.actualizar(req.params.id, req.body);
      res.json({ success: true, data: rol });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  eliminar: async (req, res) => {
    try {
      await rolesService.eliminar(req.params.id);
      res.json({ success: true, message: 'Rol desactivado correctamente' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

module.exports = rolesController;