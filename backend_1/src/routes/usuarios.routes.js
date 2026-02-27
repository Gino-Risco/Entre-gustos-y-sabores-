const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');
const { validarCampos } = require('../middlewares/validation.middleware');

router.use(verificarToken);
router.use(verificarRol('admin'));

router.get('/', usuariosController.obtenerTodos);
router.get('/:id', usuariosController.obtenerPorId);
router.post('/', validarCampos('nombre_completo', 'usuario', 'password', 'rol'), usuariosController.crear);
router.put('/:id', usuariosController.actualizar);
router.put('/:id/password', usuariosController.actualizarPassword);
router.delete('/:id', usuariosController.eliminar);

module.exports = router;