// routes/reporteCarreraRoutes.js
const express = require('express');
const router = express.Router();
const reporteCarreraController = require('../controllers/reporteCarreraController');
const { verificarToken } = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(verificarToken);

// Ruta para obtener carreras activas
router.get('/reporte-carrera/carreras', reporteCarreraController.obtenerCarrerasActivas);

// Ruta para obtener periodos
router.get('/reporte-carrera/periodos', reporteCarreraController.obtenerPeriodos);

// Ruta para generar reporte por carrera
router.post('/reporte-carrera/generar', reporteCarreraController.generarReporteCarrera);

module.exports = router;