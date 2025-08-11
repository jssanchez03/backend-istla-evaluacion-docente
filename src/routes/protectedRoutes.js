const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middleware/authMiddleware');

// Ruta solo para ADMINISTRADORES
router.get('/admin', verificarToken, verificarRol([12, 18]), (req, res) => {
  res.json({
    mensaje: 'Bienvenido administrador',
    usuario: req.usuario
  });
});

// Ruta para DOCENTES (DOCENTE y SUPER)
router.get('/docente', verificarToken, verificarRol([15, 13]), (req, res) => {
  res.json({
    mensaje: 'Bienvenido docente',
    usuario: req.usuario
  });
});

// Ruta para COORDINADORES Y ADMINISTRADORES
router.get('/coordinador', verificarToken, verificarRol([1, 17, 12, 18]), (req, res) => {
  res.json({
    mensaje: 'Bienvenido coordinador o administrador',
    usuario: req.usuario
  });
});

// Ruta solo para ESTUDIANTES
router.get('/estudiante', verificarToken, verificarRol([14]), (req, res) => {
  res.json({
    mensaje: 'Bienvenido estudiante',
    usuario: req.usuario
  });
});

module.exports = router;