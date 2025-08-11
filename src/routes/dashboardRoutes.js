const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/estadisticas-generales', verificarToken, dashboardController.getEstadisticasGenerales);
router.get('/datos-graficos', verificarToken, dashboardController.getDatosGraficos);
router.get('/detalle-participacion', verificarToken, dashboardController.getDetalleParticipacionPorTipo);
router.get('/resultados-detallados', verificarToken, dashboardController.getResultadosDetallados);
router.get('/respuestas-por-tipo/:idPeriodo', verificarToken, dashboardController.obtenerRespuestasPorTipoYDocente);
router.get('/estadisticas-tipo-pregunta/:idPeriodo', verificarToken, dashboardController.obtenerEstadisticasPorTipoPregunta);
router.get('/dashboard/mapa-calor/:idPeriodo', verificarToken, dashboardController.obtenerDatosMapaCalor);

// Promedio por ítem del formulario por tipo de evaluación
router.get('/promedio-items/:idPeriodo/:tipoEvaluacion', verificarToken, dashboardController.obtenerPromedioItemsPorTipo);
// Generar PDF de promedio por ítem
router.get('/promedio-items-pdf/:idPeriodo/:tipoEvaluacion', verificarToken, dashboardController.generarPDFPromedioItems);
// Preguntas con mejor y peor puntuación por tipo
router.get('/preguntas-extremas/:idPeriodo/:tipoEvaluacion', verificarToken, dashboardController.obtenerPreguntasExtremas);
// Promedios por carrera filtrado por tipo de evaluación
router.get('/promedios-carrera/:idPeriodo/:tipoEvaluacion', verificarToken, dashboardController.obtenerPromediosPorCarrera);


module.exports = router;
