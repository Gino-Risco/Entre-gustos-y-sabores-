const reportesService = require('../services/reportes.service');

const reportesController = {
  ventasPorDia: async (req, res) => {
    try {
      const { fecha_inicio, fecha_fin } = req.query;

      if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({
          success: false,
          message: 'Las fechas de inicio y fin son requeridas'
        });
      }

      const reportes = await reportesService.ventasPorDia(fecha_inicio, fecha_fin);
      res.json({ success: true,  reportes });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  productosMasVendidos: async (req, res) => {
    try {
      const { fecha_inicio, fecha_fin, limite } = req.query;

      if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({
          success: false,
          message: 'Las fechas de inicio y fin son requeridas'
        });
      }

      const reportes = await reportesService.productosMasVendidos(
        fecha_inicio, 
        fecha_fin, 
        parseInt(limite) || 10
      );
      res.json({ success: true, data: reportes });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  ventasPorMetodoPago: async (req, res) => {
    try {
      const { fecha_inicio, fecha_fin } = req.query;

      if (!fecha_inicio || !fecha_fin) {
        return res.status(400).json({
          success: false,
          message: 'Las fechas de inicio y fin son requeridas'
        });
      }

      const reportes = await reportesService.ventasPorMetodoPago(fecha_inicio, fecha_fin);
      res.json({ success: true, data: reportes });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  resumenTurno: async (req, res) => {
    try {
      const resumen = await reportesService.resumenTurno(req.params.turno_id);
      res.json({ success: true,  resumen });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  stockCritico: async (req, res) => {
    try {
      const stock = await reportesService.stockCritico();
      res.json({ success: true,  stock });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  inventarioValorizado: async (req, res) => {
    try {
      const inventario = await reportesService.inventarioValorizado();
      res.json({ success: true, data: inventario });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = reportesController;