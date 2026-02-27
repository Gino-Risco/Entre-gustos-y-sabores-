const comprobantesService = require('../services/comprobantes.service');

const comprobantesController = {
  obtenerTodos: async (req, res) => {
    try {
      const comprobantes = await comprobantesService.obtenerTodos();
      res.json({ success: true, data: comprobantes });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const comprobante = await comprobantesService.obtenerPorId(req.params.id);
      res.json({ success: true, data: comprobante });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  crear: async (req, res) => {
    try {
      const { pedido_id, tipo, serie, correlativo, ruc_cliente, razon_social } = req.body;
      
      // Si no viene correlativo, obtener el siguiente automático
      const correlativoFinal = correlativo || await comprobantesService.obtenerCorrelativoNext(serie);

      const comprobante = await comprobantesService.crear({
        pedido_id,
        tipo,
        serie,
        correlativo: correlativoFinal,
        ruc_cliente,
        razon_social,
        usuario_id: req.usuario.id
      });
      res.status(201).json({ success: true, data: comprobante });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  anular: async (req, res) => {
    try {
      const comprobante = await comprobantesService.anular(req.params.id, req.usuario.id);
      res.json({ success: true, data: comprobante });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

module.exports = comprobantesController;