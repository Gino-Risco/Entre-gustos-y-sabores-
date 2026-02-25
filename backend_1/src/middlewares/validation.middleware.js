// Validador genérico de campos requeridos
const validarCampos = (...campos) => {
  return (req, res, next) => {
    const faltantes = campos.filter(campo => {
      if (typeof req.body[campo] === 'undefined') return true;
      if (req.body[campo] === null) return true;
      if (typeof req.body[campo] === 'string' && req.body[campo].trim() === '') return true;
      return false;
    });

    if (faltantes.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Campos requeridos faltantes: ${faltantes.join(', ')}`
      });
    }

    next();
  };
};

module.exports = { validarCampos };