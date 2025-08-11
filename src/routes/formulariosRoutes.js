const express = require('express');
const router = express.Router();
const { verificarToken, verificarRol } = require('../middleware/authMiddleware');
const formulariosController = require('../controllers/formulariosController');

// Rutas protegidas: solo ADMIN (12) y COORDINADOR (1, 17)
const rolesPermitidos = [1, 12, 17, 18];

// Formularios
router.get('/formularios', verificarToken, formulariosController.listarFormularios);
router.post('/formularios', verificarToken, verificarRol(rolesPermitidos), formulariosController.crearFormulario);
router.put('/formularios/:id', verificarToken, verificarRol(rolesPermitidos), formulariosController.actualizarFormulario);
router.delete('/formularios/:id', verificarToken, verificarRol(rolesPermitidos), formulariosController.eliminarFormulario);

// Preguntas
router.get('/formularios/:id/preguntas', verificarToken, formulariosController.listarPreguntas);
router.post('/preguntas', verificarToken, verificarRol(rolesPermitidos), formulariosController.crearPregunta);
router.put('/preguntas/:id', verificarToken, verificarRol(rolesPermitidos), formulariosController.actualizarPregunta);
router.delete('/preguntas/:id', verificarToken, verificarRol(rolesPermitidos), formulariosController.eliminarPregunta);

module.exports = router;