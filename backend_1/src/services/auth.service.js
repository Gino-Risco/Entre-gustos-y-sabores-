const pool = require('../config/db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

class AuthService {
  async login(usuario, password) {
    // Buscar usuario
    const result = await pool.query(
      'SELECT id, nombre_completo, usuario, password_hash, rol, activo, password_hash_algorithm FROM usuarios WHERE usuario = $1',
      [usuario]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    const user = result.rows[0];

    // Verificar si está activo
    if (!user.activo) {
      throw new Error('Usuario desactivado. Contacte al administrador.');
    }

    // Verificar contraseña
    const passwordValido = await bcrypt.compare(password, user.password_hash);

    if (!passwordValido) {
      throw new Error('Usuario o contraseña incorrectos');
    }

    // Actualizar último acceso
    await pool.query(
      'UPDATE usuarios SET ultimo_acceso = CURRENT_TIMESTAMP WHERE id = $1',
      [user.id]
    );

    // Generar token JWT
    const token = jwt.sign(
      { id: user.id, usuario: user.usuario, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRE }
    );

    return {
      token,
      usuario: {
        id: user.id,
        nombre_completo: user.nombre_completo,
        usuario: user.usuario,
        rol: user.rol
      }
    };
  }

  async cambiarPassword(usuarioId, passwordActual, passwordNuevo) {
    const result = await pool.query(
      'SELECT password_hash FROM usuarios WHERE id = $1',
      [usuarioId]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const passwordValido = await bcrypt.compare(passwordActual, result.rows[0].password_hash);

    if (!passwordValido) {
      throw new Error('Contraseña actual incorrecta');
    }

    const passwordHash = await bcrypt.hash(passwordNuevo, 10);

    await pool.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id = $2',
      [passwordHash, usuarioId]
    );

    return { message: 'Contraseña actualizada correctamente' };
  }
}

module.exports = new AuthService();