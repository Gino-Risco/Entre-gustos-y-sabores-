const mesasService = require('../services/mesas.service');

const mesasController = {
  obtenerTodas: async (req, res) => {
    try {
      const mesas = await mesasService.obtenerTodas();
      res.json({ success: true, data: mesas });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerDisponibles: async (req, res) => {
    try {
      const mesas = await mesasService.obtenerDisponibles();
      res.json({ success: true, data: mesas });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const mesa = await mesasService.obtenerPorId(req.params.id);
      res.json({ success: true, data: mesa });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  crear: async (req, res) => {
    try {
      const { nombre, capacidad, ubicacion } = req.body;
      const mesa = await mesasService.crear({ nombre, capacidad, ubicacion });
      res.status(201).json({ success: true, data: mesa });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  actualizar: async (req, res) => {
    try {
      const mesa = await mesasService.actualizar(req.params.id, req.body);
      res.json({ success: true, data: mesa });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  actualizarEstado: async (req, res) => {
    try {
      const { estado } = req.body;
      const mesa = await mesasService.actualizarEstado(req.params.id, estado);
      res.json({ success: true, data: mesa });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  eliminar: async (req, res) => {
    try {
      const mesa = await mesasService.eliminar(req.params.id);
      res.json({ success: true, data: mesa, message: 'Mesa eliminada correctamente' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

module.exports = mesasController;