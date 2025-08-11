const express = require('express');
const router = express.Router();
const asignacionesController = require('../controllers/asignacionesController');
const { verificarToken } = require('../middleware/authMiddleware');

// ✅ Rutas más específicas PRIMERO
router.get('/asignaciones', verificarToken, asignacionesController.getAsignacionesCompletas);
router.get('/asignaciones/docentes-evaluadores/:idPeriodo', verificarToken, asignacionesController.getDocentesEvaluadores);
router.get('/asignaciones/docentes-materias/:idPeriodo', verificarToken, asignacionesController.getDocentesConMaterias);
router.get('/asignaturas/:idPeriodo', verificarToken, asignacionesController.getAsignaturasPorPeriodo);

// ✅ Rutas con parámetros AL FINAL
router.post('/asignaciones/crear', verificarToken, asignacionesController.crearAsignacion);
router.get('/asignaciones/:idPeriodo', verificarToken, asignacionesController.obtenerAsignaciones);
router.delete('/asignaciones/:idAsignacion', verificarToken, asignacionesController.eliminarAsignacion);
router.put('/asignaciones/:idAsignacion', verificarToken, asignacionesController.editarAsignacion);

module.exports = router;