const usuariosService = require('../services/usuarios.service');

const getAllUsuarios = async (req, res, next) => {
  try {
    const usuarios = await usuariosService.getAllUsuarios();
    res.json(usuarios);
  } catch (error) {
    next(error);
  }
};

const getUsuarioById = async (req, res, next) => {
  try {
    const usuario = await usuariosService.getUsuarioById(req.params.id);
    res.json(usuario);
  } catch (error) {
    next(error);
  }
};

const createUsuario = async (req, res, next) => {
  try {
    const nuevoUsuario = await usuariosService.createUsuario(req.body);
    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: nuevoUsuario
    });
  } catch (error) {
    next(error);
  }
};

const updateUsuario = async (req, res, next) => {
  try {
    const usuarioActualizado = await usuariosService.updateUsuario(req.params.id, req.body);
    res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: usuarioActualizado
    });
  } catch (error) {
    next(error);
  }
};

const deleteUsuario = async (req, res, next) => {
  try {
    const resultado = await usuariosService.deleteUsuario(req.params.id);
    res.json({
      success: true,
      message: resultado.message
    });
  } catch (error) {
    next(error);
  }
};

const getAllRoles = async (req, res, next) => {
  try {
    const roles = await usuariosService.getAllRoles();
    res.json(roles);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAllUsuarios,
  getUsuarioById,
  createUsuario,
  updateUsuario,
  deleteUsuario,
  getAllRoles
};