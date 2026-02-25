const authService = require('../services/auth.service');

const authController = {
  login: async (req, res) => {
    try {
      const { usuario, password } = req.body;

      if (!usuario || !password) {
        return res.status(400).json({
          success: false,
          message: 'Usuario y contraseña son requeridos'
        });
      }

      const resultado = await authService.login(usuario, password);

      res.json({
        success: true,
        message: 'Login exitoso',
        data: resultado
      });
    } catch (error) {
      res.status(401).json({
        success: false,
        message: error.message
      });
    }
  },

  cambiarPassword: async (req, res) => {
    try {
      const { password_actual, password_nuevo } = req.body;

      if (!password_actual || !password_nuevo) {
        return res.status(400).json({
          success: false,
          message: 'Contraseña actual y nueva son requeridas'
        });
      }

      if (password_nuevo.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'La contraseña debe tener al menos 6 caracteres'
        });
      }

      const resultado = await authService.cambiarPassword(
        req.usuario.id,
        password_actual,
        password_nuevo
      );

      res.json({
        success: true,
        message: resultado.message
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
};

module.exports = authController;