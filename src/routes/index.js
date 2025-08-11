const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const protectedRoutes = require('./protectedRoutes');
const formulariosRoutes = require('./formulariosRoutes');
const evaluacionesRoutes = require('./evaluacionesRoutes');
const usuarioRoutes = require('./usuarioRoutes');
const filtrosRoutes = require('./filtrosRoutes');
const asignacionesRoutes = require('./asignacionesRoutes');
const dashboardRoutes = require('./dashboardRoutes');
const reporteCoevaluacionRoutes = require('./reporteCoevaluacionRoutes');
const coordinador = require('./coordinadorRoutes');
const autoridadesRoutes = require('./autoridadesRoutes');
const evaluacionAutoridadesRoutes = require('./evaluacionAutoridadesRoutes');
const reporteCarreraRoutes = require('./reporteCarreraRoutes');
const reportesCalificacionCarreraRoutes = require('./reportesCalificacionCarreraRoutes');

router.use('/v1', authRoutes);
router.use('/v1', protectedRoutes); 
router.use('/v1', formulariosRoutes);
router.use('/v1', evaluacionesRoutes);
router.use('/v1', usuarioRoutes);
router.use('/v1', filtrosRoutes);
router.use('/v1', asignacionesRoutes);
router.use('/v1', dashboardRoutes);
router.use('/v1', reporteCoevaluacionRoutes);
router.use('/v1', coordinador);
router.use('/v1', autoridadesRoutes);
router.use('/v1', evaluacionAutoridadesRoutes);
router.use('/v1', reporteCarreraRoutes);
router.use('/v1', reportesCalificacionCarreraRoutes);

module.exports = router;