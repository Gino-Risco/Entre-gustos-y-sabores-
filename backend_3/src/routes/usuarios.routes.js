const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');

// Rutas de Usuarios ( /api/usuarios )
router.get('/roles', usuariosController.getAllRoles);
router.get('/', usuariosController.getAllUsuarios);
router.get('/:id', usuariosController.getUsuarioById);
router.post('/', usuariosController.createUsuario);
router.put('/:id', usuariosController.updateUsuario);
router.delete('/:id', usuariosController.deleteUsuario); // Borrado lógico (Desactivar)

module.exports = router;