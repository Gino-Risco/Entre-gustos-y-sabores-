const express = require('express');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const { verificarToken } = require('../middlewares/auth.middleware');
const { validarCampos } = require('../middlewares/validation.middleware');

router.post('/login', validarCampos('usuario', 'password'), authController.login);
router.post('/cambiar-password', verificarToken, validarCampos('password_actual', 'password_nuevo'), authController.cambiarPassword);

module.exports = router;