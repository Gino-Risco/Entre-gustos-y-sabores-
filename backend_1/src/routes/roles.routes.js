const express = require('express');
const router = express.Router();
const rolesController = require('../controllers/roles.controller');
const { verificarToken, verificarRol } = require('../middlewares/auth.middleware');

router.use(verificarToken);
router.use(verificarRol('admin'));

router.get('/', rolesController.obtenerTodos);
router.get('/:id', rolesController.obtenerPorId);
router.post('/', rolesController.crear);
router.put('/:id', rolesController.actualizar);
router.delete('/:id', rolesController.eliminar);

module.exports = router;