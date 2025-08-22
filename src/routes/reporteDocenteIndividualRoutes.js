const express = require('express');
const router = express.Router();
const reporteDocenteIndividualController = require('../controllers/reporteDocenteIndividualController');
const { verificarToken } = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(verificarToken);

// Generar reporte PDF individual para un docente
router.get('/reporte-docente-individual/pdf/:idPeriodo/:cedulaDocente', reporteDocenteIndividualController.generarReporteDocente);

// Obtener datos del docente para vista previa
router.get('/reporte-docente-individual/datos/:idPeriodo/:cedulaDocente', reporteDocenteIndividualController.obtenerDatosDocente);

module.exports = router;
