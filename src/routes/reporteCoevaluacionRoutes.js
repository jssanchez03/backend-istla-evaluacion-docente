const express = require('express');
const router = express.Router();
const reporteCoevaluacionController = require('../controllers/reporteCoevaluacionController');
const { verificarToken } = require('../middleware/authMiddleware');

// Ruta para generar el reporte PDF
router.get('/generar/:idPeriodo', verificarToken, reporteCoevaluacionController.generarReporte);
// Ruta para previsualizar datos (opcional)
router.get('/preview/:idPeriodo', verificarToken, reporteCoevaluacionController.previsualizarDatos);
// Ruta para obtener autoridades disponibles para firmas
router.get('/autoridades-firmas', verificarToken, reporteCoevaluacionController.obtenerAutoridadesParaFirmas);
// Ruta para generar el reporte Excel
router.get('/generar-excel/:idPeriodo', verificarToken, reporteCoevaluacionController.generarReporteExcel);
// Ruta para generar reporte PDF por carrera específica (administrador)
router.get('/generar-por-carrera/:idCarrera/:idPeriodo', verificarToken, reporteCoevaluacionController.generarReportePorCarrera);
// Ruta para generar reporte Excel por carrera específica (administrador)
router.get('/generar-excel-por-carrera/:idCarrera/:idPeriodo', verificarToken, reporteCoevaluacionController.generarReporteExcelPorCarrera);
// Ruta para previsualizar datos por carrera específica (administrador)
router.get('/preview-por-carrera/:idCarrera/:idPeriodo', verificarToken, reporteCoevaluacionController.previsualizarDatosPorCarrera);
// Ruta para obtener todas las carreras activas (para dropdown de administrador)
router.get('/carreras-activas', verificarToken, reporteCoevaluacionController.obtenerCarrerasActivas);
// Ruta para obtener estadísticas de asignaciones por carrera
router.get('/estadisticas/:idCarrera/:idPeriodo', verificarToken, reporteCoevaluacionController.obtenerEstadisticasCarrera);
// Ruta para generar el reporte Excel general (admin)
router.get('/generar-excel-general/:idPeriodo', verificarToken, reporteCoevaluacionController.generarReporteExcelGeneral);

module.exports = router;