const express = require('express');
const router = express.Router();
const autoridadesController = require('../controllers/autoridadesController');
const { verificarToken } = require('../middleware/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verificarToken);

// GET /autoridades - Listar todas las autoridades
router.get('/autoridades-firmas', autoridadesController.listarAutoridades);
// GET /autoridades/firmas - Obtener autoridades para firmas de reportes
router.get('/firmas', autoridadesController.obtenerAutoridadesParaFirmas);
// GET /autoridades/:id - Obtener autoridad por ID
router.get('/autoridades-firmas/:id', autoridadesController.obtenerAutoridadPorId);
// POST /autoridades - Crear nueva autoridad
router.post('/autoridades-firmas', autoridadesController.crearAutoridad);
// PUT /autoridades/:id - Actualizar autoridad
router.put('/autoridades-firmas/:id', autoridadesController.actualizarAutoridad);
// DELETE /autoridades/:id - Eliminar autoridad
router.delete('/autoridades-firmas/:id', autoridadesController.eliminarAutoridad);
// Agregar esta ruta a tu archivo de rutas de autoridades
router.put('/actualizar-ordenes', autoridadesController.actualizarOrdenesMultiples);

module.exports = router;