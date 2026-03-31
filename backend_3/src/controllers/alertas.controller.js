const alertasService = require('../services/alertas.service');

// 1. Obtener todas las alertas
async function getAll(req, res, next) {
  try {
    const alertas = await alertasService.getAll();
    
    // Lo envolvemos en "data: { alertas }" para que tu Frontend 
    // lo encuentre exactamente donde lo está buscando
    res.json({
      success: true,
      data: { alertas } 
    });
  } catch (error) {
    next(error); // Pasamos el error a tu middleware de manejo de errores
  }
}

// 2. Obtener productos con stock bajo
async function getStockBajo(req, res, next) {
  try {
    const productos = await alertasService.getStockBajo();
    
    // Lo envolvemos en "data: { productos }" para que coincida con el service de React
    res.json({
      success: true,
      data: { productos }
    });
  } catch (error) {
    next(error);
  }
}

// 3. Marcar como atendida (Simulado contablemente)
async function marcarAtendida(req, res, next) {
  try {
    const { id } = req.params;
    const resultado = await alertasService.marcarAtendida(id);
    
    res.json({
      success: true,
      data: resultado
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getAll,
  getStockBajo,
  marcarAtendida
};