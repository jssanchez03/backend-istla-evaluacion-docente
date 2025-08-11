const express = require('express');
const router = express.Router();
const filtrosController = require('../controllers/filtrosController');
const { verificarToken } = require('../middleware/authMiddleware');

router.get('/periodos', verificarToken, filtrosController.getPeriodos);
router.get('/docentes/:idPeriodo', verificarToken, filtrosController.getDocentesPorPeriodo);
router.get('/distributivos/:idPeriodo', verificarToken, filtrosController.getDistributivosDocente);
router.get('/docentes-estudiante/:idPeriodo', verificarToken, filtrosController.obtenerDocentesParaEstudiante);

module.exports = router;
