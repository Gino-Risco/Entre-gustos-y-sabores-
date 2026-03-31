const express = require('express');
const router = express.Router();
const upload = require('../config/upload.config'); // Asegúrate de que esta ruta apunte al archivo config que creamos antes

// Ruta completa final será: POST /api/upload
router.post('/', upload.single('imagen'), (req, res) => {
  try {
    // Si no viene ninguna imagen en la petición, lanzamos error
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        message: 'No se recibió ninguna imagen' 
      });
    }

    // Cloudinary hace la magia y nos devuelve la URL segura en req.file.path
    const imagenUrl = req.file.path; 
    
    res.status(200).json({
      success: true,
      data: { url: imagenUrl }
    });

  } catch (error) {
    console.error('Error al subir imagen a Cloudinary:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error interno al subir la imagen' 
    });
  }
});

module.exports = router;