const comprasService = require('../services/compras.service');

const comprasController = {
  obtenerTodas: async (req, res) => {
    try {
      const compras = await comprasService.obtenerTodas();
      res.json({ success: true, data: compras });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const compra = await comprasService.obtenerPorId(req.params.id);
      res.json({ success: true, data: compra });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  crear: async (req, res) => {
    try {
      const { proveedor_id, numero_comprobante, detalles, notas } = req.body;
      const compra = await comprasService.crear({
        proveedor_id,
        usuario_id: req.usuario.id,
        numero_comprobante,
        detalles,
        notas
      });
      res.status(201).json({ success: true, data: compra });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  completarCompra: async (req, res) => {
    try {
      const compra = await comprasService.completarCompra(req.params.id, req.usuario.id);
      res.json({ success: true, data: compra, message: 'Compra completada. Stock actualizado automáticamente.' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  cancelarCompra: async (req, res) => {
    try {
      const compra = await comprasService.cancelarCompra(req.params.id, req.usuario.id);
      res.json({ success: true, data: compra });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

module.exports = comprasController;