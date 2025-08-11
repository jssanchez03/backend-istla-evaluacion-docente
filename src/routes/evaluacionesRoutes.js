const express = require('express');
const router = express.Router();
const { verificarToken } = require('../middleware/authMiddleware');
const evaluacionesController = require('../controllers/evaluacionesController');

// Crear una nueva evaluación
router.post('/evaluaciones', verificarToken, evaluacionesController.crearEvaluacion);
// Guardar respuestas a una evaluación existente
router.post('/evaluaciones/:id/respuestas', verificarToken, evaluacionesController.guardarRespuestas);
// Ver mis evaluaciones hechas
router.get('/evaluaciones/mis-evaluaciones', verificarToken, evaluacionesController.misEvaluaciones);
// Ver todas mis evaluaciones (incluye pendientes y completadas)
router.get('/evaluaciones/todas-mis-evaluaciones', verificarToken, evaluacionesController.misEvaluacionesTodas);
// Obtener evaluación por ID
router.get("/evaluaciones/:id", verificarToken, evaluacionesController.obtenerEvaluacionPorId);
// Obtener resúmenes de evaluación por periodo
router.get('/evaluaciones/resumen/periodo/:periodoId', verificarToken, evaluacionesController.obtenerResúmenesPorPeriodo);
// Evaluaciones para estudiantes (solo heteroevaluaciones)
router.get('/evaluaciones/estudiante/mis-evaluaciones', verificarToken, evaluacionesController.evaluacionesEstudiante);
// Evaluaciones para docentes (coevaluación y autoevaluación)
router.get('/evaluaciones/docente/mis-evaluaciones', verificarToken, evaluacionesController.evaluacionesDocente);
// Notificar evaluaciones por docente
router.post('/evaluaciones/:id/notificar', verificarToken, evaluacionesController.notificarEvaluacion);
// Notificar evaluaciones por docente coevaluación
router.post('/notificar-docentes-coevaluacion/:idPeriodo', verificarToken, evaluacionesController.notificarDocentesCoevaluacion);
// Eliminar evaluación
router.delete('/evaluaciones/:id', verificarToken, evaluacionesController.eliminarEvaluacion);
// Editar evaluación
router.put('/evaluaciones/:id', verificarToken, evaluacionesController.editarEvaluacion);

module.exports = router;