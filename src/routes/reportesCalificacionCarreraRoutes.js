// routes/reportesCalificacionCarreraRoutes.js
const express = require('express');
const router = express.Router();
const reportesCalificacionCarreraController = require('../controllers/reportesCalificacionCarreraController');
const { verificarToken } = require('../middleware/authMiddleware');

// Obtener carreras activas
router.get('/carreras-activas', verificarToken, reportesCalificacionCarreraController.obtenerCarrerasActivas);

// Obtener periodos
router.get('/periodos', verificarToken, reportesCalificacionCarreraController.obtenerPeriodos);

// Generar reporte PDF por carrera específica
router.get('/reportes-calificacion-carrera/generar-por-carrera/:idCarrera/:idPeriodo', verificarToken, reportesCalificacionCarreraController.generarReportePDFPorCarrera);

// Generar reporte PDF de todas las carreras
router.get('/reportes-calificacion-carrera/generar-todas-carreras/:idPeriodo', verificarToken, reportesCalificacionCarreraController.generarReportePDFTodasCarreras);

// Obtener datos del reporte (sin generar PDF)
router.get('/reportes-calificacion-carrera/datos/:idCarrera/:idPeriodo', verificarToken, reportesCalificacionCarreraController.obtenerDatosReporte);

module.exports = router;