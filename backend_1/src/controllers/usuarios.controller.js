const usuariosService = require('../services/usuarios.service');

const usuariosController = {
  obtenerTodos: async (req, res) => {
    try {
      const usuarios = await usuariosService.obtenerTodos();
      res.json({ success: true,  usuarios });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const usuario = await usuariosService.obtenerPorId(req.params.id);
      res.json({ success: true,  usuario });
    } catch (error) {
      res.status(404).json({ success: false, message: error.message });
    }
  },

  crear: async (req, res) => {
    try {
      const { nombre_completo, usuario, password, rol } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
      }

      const usuarioCreado = await usuariosService.crear({ nombre_completo, usuario, password, rol });
      res.status(201).json({ success: true, data: usuarioCreado });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  actualizar: async (req, res) => {
    try {
      const usuario = await usuariosService.actualizar(req.params.id, req.body);
      res.json({ success: true,  usuario });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  actualizarPassword: async (req, res) => {
    try {
      const { password } = req.body;

      if (!password || password.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
      }

      await usuariosService.actualizarPassword(req.params.id, password);
      res.json({ success: true, message: 'Contraseña actualizada correctamente' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  },

  eliminar: async (req, res) => {
    try {
      await usuariosService.eliminar(req.params.id);
      res.json({ success: true, message: 'Usuario desactivado correctamente' });
    } catch (error) {
      res.status(400).json({ success: false, message: error.message });
    }
  }
};

module.exports = usuariosController;