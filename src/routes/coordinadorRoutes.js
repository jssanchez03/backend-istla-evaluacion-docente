const express = require('express');
const router = express.Router();
const coordinadorController = require('../controllers/coordinadorController');
const { verificarToken } = require('../middleware/authMiddleware');

// Ruta para obtener datos de los selects (coordinadores y carreras)
router.get('/datos-selects', verificarToken, coordinadorController.obtenerDatosSelects);
// Ruta para obtener todas las asignaciones de coordinadores
router.get('/coordinadores/asignaciones', verificarToken, coordinadorController.obtenerAsignacionesCoordinadores);
// Ruta para obtener un coordinador específico por ID
router.get('/coordinadores/asignaciones/:id', verificarToken, coordinadorController.obtenerCoordinadorPorId);
// Ruta para crear nueva asignación de coordinador
router.post('/coordinadores/asignaciones', verificarToken, coordinadorController.crearCoordinadorCarrera);
// Ruta para actualizar asignación de coordinador
router.put('/coordinadores/asignaciones/:id', verificarToken, coordinadorController.actualizarCoordinadorCarrera);
// Ruta para eliminar (desactivar) asignación de coordinador
router.delete('/coordinadores/asignaciones/:id', verificarToken, coordinadorController.eliminarCoordinadorCarrera);

module.exports = router;