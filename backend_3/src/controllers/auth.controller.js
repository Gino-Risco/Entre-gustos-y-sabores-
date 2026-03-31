const catchAsync = require('../utils/catchAsync');
const authService = require('../services/auth.service');

const login = catchAsync(async (req, res) => {
  const { usuario, password } = req.body;

  if (!usuario || !password) {
    return res.status(400).json({
      success: false,
      error: { message: 'Usuario y contraseña son requeridos' },
    });
  }

  const result = await authService.login(usuario, password);

  res.json({ success: true, data: result });
});

const getMe = catchAsync(async (req, res) => {
  const user = await authService.getUserById(req.user.id);
  res.json({ success: true, data: { user } });
});

module.exports = { login, getMe };