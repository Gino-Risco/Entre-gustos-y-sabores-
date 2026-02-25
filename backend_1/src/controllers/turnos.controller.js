const turnosService = require('../services/turnos.service');

const turnosController = {
  abrirTurno: async (req, res) => {
    try {
      const { monto_inicial } = req.body;

      if (!monto_inicial || monto_inicial < 0) {
        return res.status(400).json({
          success: false,
          message: 'Monto inicial es requerido y debe ser mayor o igual a 0'
        });
      }

      const turno = await turnosService.abrirTurno(req.usuario.id, monto_inicial);
      res.status(201).json({ success: true, data: turno });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  obtenerTurnoAbierto: async (req, res) => {
    try {
      const turno = await turnosService.obtenerTurnoAbierto(req.usuario.id);
      res.json({ success: true, data: turno });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  cerrarTurno: async (req, res) => {
    try {
      const { turno_id, monto_real, observaciones } = req.body;

      if (!turno_id || !monto_real) {
        return res.status(400).json({
          success: false,
          message: 'ID del turno y monto real son requeridos'
        });
      }

      const resultado = await turnosService.cerrarTurno(
        turno_id,
        monto_real,
        observaciones || '',
        req.usuario.id
      );

      res.json({ success: true, data: resultado });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  obtenerHistorial: async (req, res) => {
    try {
      const limite = parseInt(req.query.limite) || 10;
      const turnos = await turnosService.obtenerHistorial(req.usuario.id, limite);
      res.json({ success: true, data: turnos });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
};

module.exports = turnosController;