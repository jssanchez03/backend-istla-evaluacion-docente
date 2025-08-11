const express = require('express');
const router = express.Router();
const evaluacionAutoridadesController = require('../controllers/evaluacionAutoridadesController');
const { verificarToken } = require('../middleware/authMiddleware');

// Aplicar middleware de autenticación a todas las rutas
router.use(verificarToken);

// GET /api/evaluacion-autoridades/datos-iniciales
// Obtener períodos y carreras para inicializar formulario
router.get('/evaluacion-autoridades/datos-iniciales', evaluacionAutoridadesController.obtenerDatosIniciales);

// GET /api/evaluacion-autoridades/docentes?idPeriodo=1&idCarrera=2
// Obtener docentes filtrados por período y carrera
router.get('/evaluacion-autoridades/docentes', evaluacionAutoridadesController.obtenerDocentes);

// POST /api/evaluacion-autoridades/evaluacion
// Crear nueva evaluación de autoridad
router.post('/evaluacion-autoridades/evaluacion', evaluacionAutoridadesController.crearEvaluacion);

// GET /api/evaluacion-autoridades/evaluaciones/:idPeriodo
// Obtener todas las evaluaciones de un período específico
router.get('/evaluacion-autoridades/evaluaciones/:idPeriodo', evaluacionAutoridadesController.obtenerEvaluacionesPorPeriodo);

// GET /api/evaluacion-autoridades/evaluacion/:idPeriodo/:idDocente/:evaluadorCedula
// Obtener evaluación específica de un docente por un evaluador
router.get('/evaluacion/:idPeriodo/:idDocente/:evaluadorCedula', evaluacionAutoridadesController.obtenerEvaluacionDocente);

// PUT /api/evaluacion-autoridades/evaluacion/:idEvaluacion
// Actualizar evaluación existente
router.put('/evaluacion-autoridades/evaluacion/:idEvaluacion', evaluacionAutoridadesController.actualizarEvaluacion);

// DELETE /api/evaluacion-autoridades/evaluacion/:idEvaluacion
// Eliminar evaluación (soft delete)
router.delete('/evaluacion-autoridades/evaluacion/:idEvaluacion', evaluacionAutoridadesController.eliminarEvaluacion);

// GET /api/evaluacion-autoridades/resumen/:idPeriodo
// Obtener resumen estadístico de evaluaciones por período
router.get('/evaluacion-autoridades/resumen/:idPeriodo', evaluacionAutoridadesController.obtenerResumen);

module.exports = router;